import { Router } from 'express';
import crypto from 'crypto';
import { ok, created, noContent, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, listWhere, addDoc, patchDoc, deleteDoc, getDoc, db, FieldValue } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();
const TIERS = ['Bronze', 'Silver', 'Gold'];

// Id de cada doc de `benefits`, siguiendo la convención del documento de Max
// ("ID: bnf_ + 10 hex"). Los beneficios ya no viven en un array embebido en
// el sponsor ni con un id compuesto propio: son documentos normales de la
// colección raíz `benefits`, con el mismo esquema de id que cualquier otra
// colección de este proyecto (auto-generado por nosotros, no por Firestore,
// para tener el prefijo "bnf_").
const newBenefitId = () => `bnf_${crypto.randomBytes(5).toString('hex')}`;

// Normaliza los beneficios que llegan del formulario, contra los datos que
// el sponsor ya tenía. Si un beneficio ya existía (mismo id), conserva su
// `redeemedCount` — nunca se resetea un canje ya hecho solo por editar el
// sponsor.
function normalizeBenefits(input = [], previous = []) {
  const prevById = new Map(previous.map((b) => [b.id, b]));
  return input
    .map((b) => {
      const prev = b.id ? prevById.get(b.id) : undefined;
      return {
        id: prev ? prev.id : newBenefitId(),
        name: String(b.name || '').trim(),
        description: b.description || null,
        costPlatinum: Math.max(0, Number(b.costPlatinum) || 0),
        stock: Math.max(0, Number(b.stock) || 0),
        redeemedCount: prev ? prev.redeemedCount : 0,
        active: prev ? prev.active : true,
        icon: b.icon || null,
        expiresAt: b.expiresAt || null,
      };
    })
    .filter((b) => b.name);
}

// benefitsOffered = cantidad de beneficios ACTIVOS (no la suma de stock,
// como se hacía antes con el array embebido) — así lo define el documento
// de Max. benefitsRedeemed = canjes acumulados, se cuenten o no beneficios
// dados de baja.
function totals(benefits = []) {
  return {
    benefitsOffered: benefits.filter((b) => b.active !== false).length,
    benefitsRedeemed: benefits.reduce((a, b) => a + (b.redeemedCount || 0), 0),
  };
}

// Trae los beneficios de un sponsor desde la colección raíz `benefits`,
// denormalizados con el id real del documento (ya no hace falta derivarlo:
// el id que ve el frontend ES el id del documento en Firestore).
async function getSponsorBenefits(sponsorId) {
  return listWhere(COL.benefits, 'sponsorId', sponsorId);
}

// Guarda el catálogo completo de beneficios de un sponsor: borra los que ya
// no vienen, crea los nuevos (con id bnf_...) y actualiza el resto.
async function saveSponsorBenefits(sponsor, benefits, previousBenefits) {
  const prevIds = new Set((previousBenefits || []).map((b) => b.id));
  const nextIds = new Set(benefits.map((b) => b.id));
  const isNew = (b) => !prevIds.has(b.id);

  await Promise.all([
    ...[...prevIds].filter((id) => !nextIds.has(id)).map((id) => deleteDoc(COL.benefits, id)),
    ...benefits.map((b) => {
      const { id, ...data } = b;
      const payload = { ...data, sponsorId: sponsor.id, sponsorName: sponsor.name, updatedAt: FieldValue.serverTimestamp() };
      if (isNew(b)) payload.createdAt = FieldValue.serverTimestamp();
      return db.collection(COL.benefits).doc(id).set(payload, { merge: true });
    }),
  ]);
}

// Adjunta `benefits` + los totales derivados a un doc de sponsor, leyendo
// desde la colección `benefits` (el sponsor ya no guarda el array embebido).
async function withBenefits(sponsorDoc) {
  const benefits = await getSponsorBenefits(sponsorDoc.id);
  return { ...sponsorDoc, benefits, ...totals(benefits) };
}

// Un sponsor con `deletedAt` es un sponsor dado de baja (borrado lógico):
// se trata como inexistente para cualquier operación de escritura o lectura
// normal, tal como especifica el documento de Max.
const isDeleted = (doc) => !!doc?.deletedAt;

r.get('/sponsors', requireRole('finance'), wrap(async (_req, res) => {
  const sponsors = (await listAll(COL.sponsors, 'name')).filter((s) => !isDeleted(s));
  return ok(res, await Promise.all(sponsors.map(withBenefits)));
}));

r.post('/sponsors', requireRole('finance'), wrap(async (req, res) => {
  const { name, tier, monthlyFee, contactEmail, benefits = [] } = req.body || {};
  if (!name) return fail(res, 400, 'VALIDATION', 'name es obligatorio');
  if (tier && !TIERS.includes(tier)) return fail(res, 400, 'VALIDATION', `tier debe ser uno de ${TIERS.join(', ')}`);
  const normalized = normalizeBenefits(benefits);
  const sponsor = await addDoc(COL.sponsors, {
    name, tier: tier || 'Bronze', monthlyFee: Number(monthlyFee || 0),
    status: 'ok',
    // Campos del modelo canónico de Max no cubiertos en la primera pasada de
    // Fase 1 (ver MODELO_CAMBIOS.md): búsqueda case-insensitive, contacto,
    // borrado lógico y trazabilidad de quién crea/edita.
    nameLower: name.trim().toLowerCase(),
    contactEmail: contactEmail || null,
    deletedAt: null,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });
  await saveSponsorBenefits(sponsor, normalized, []);
  await logAudit(req, 'create', `sponsors/${sponsor.id}`, { name: sponsor.name });
  return created(res, { ...sponsor, benefits: normalized, ...totals(normalized) });
}));

r.patch('/sponsors/:id', requireRole('finance'), wrap(async (req, res) => {
  const current = await getDoc(COL.sponsors, req.params.id);
  if (!current || isDeleted(current)) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const allowed = ['name', 'tier', 'monthlyFee', 'status', 'contactEmail'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  if (patch.name) patch.nameLower = String(patch.name).trim().toLowerCase();
  patch.updatedBy = req.user.id;
  const doc = await patchDoc(COL.sponsors, req.params.id, patch);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  // Si cambió el nombre, se propaga a `sponsorName` en cada beneficio del sponsor
  // (campo denormalizado, según el documento de Max).
  if (patch.name) {
    const benefits = await getSponsorBenefits(doc.id);
    await Promise.all(benefits.map((b) => patchDoc(COL.benefits, b.id, { sponsorName: patch.name })));
  }
  await logAudit(req, 'update', `sponsors/${req.params.id}`, patch);
  return ok(res, await withBenefits(doc));
}));

// Reemplaza el catálogo de beneficios de un sponsor.
r.put('/sponsors/:id/benefits', requireRole('finance'), wrap(async (req, res) => {
  const current = await getDoc(COL.sponsors, req.params.id);
  if (!current || isDeleted(current)) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const previousBenefits = await getSponsorBenefits(current.id);
  const normalized = normalizeBenefits(req.body?.benefits || [], previousBenefits);
  await saveSponsorBenefits(current, normalized, previousBenefits);
  await patchDoc(COL.sponsors, current.id, { updatedBy: req.user.id });
  await logAudit(req, 'update', `sponsors/${req.params.id}/benefits`, { count: normalized.length });
  return ok(res, { ...current, benefits: normalized, ...totals(normalized) });
}));

// Registra el canje de un beneficio: baja stock, sube redeemedCount, y si el
// stock llega a 0 lo marca inactivo (active:false), tal como especifica el
// documento de Max ("false al dar de baja el sponsor o agotar stock").
r.post('/sponsors/:id/benefits/:benefitId/redeem', requireRole('finance'), wrap(async (req, res) => {
  const sponsor = await getDoc(COL.sponsors, req.params.id);
  if (!sponsor || isDeleted(sponsor)) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const cantidad = Math.max(1, Number(req.body?.cantidad) || 1);
  const benefits = await getSponsorBenefits(sponsor.id);
  const idx = benefits.findIndex((b) => b.id === req.params.benefitId);
  if (idx === -1) return fail(res, 404, 'NOT_FOUND', 'Beneficio no encontrado');
  if (benefits[idx].stock < cantidad) return fail(res, 400, 'VALIDATION', 'Stock insuficiente');
  const newStock = benefits[idx].stock - cantidad;
  benefits[idx] = {
    ...benefits[idx],
    stock: newStock,
    redeemedCount: benefits[idx].redeemedCount + cantidad,
    active: newStock > 0,
  };
  await patchDoc(COL.benefits, req.params.benefitId, {
    stock: benefits[idx].stock,
    redeemedCount: benefits[idx].redeemedCount,
    active: benefits[idx].active,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await logAudit(req, 'redeem', `sponsors/${req.params.id}/benefits/${req.params.benefitId}`, { cantidad });
  return ok(res, { ...sponsor, benefits, ...totals(benefits) });
}));

// Baja de un sponsor: borrado lógico (`deletedAt`), no físico. El documento
// de Max especifica que sus beneficios pasan a `active:false` en cascada
// (no se borran) al dar de baja el sponsor, igual que al agotarse el stock.
r.delete('/sponsors/:id', requireRole('finance'), wrap(async (req, res) => {
  const doc = await getDoc(COL.sponsors, req.params.id);
  if (!doc || isDeleted(doc)) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const benefits = await getSponsorBenefits(doc.id);
  await Promise.all(benefits
    .filter((b) => b.active !== false)
    .map((b) => patchDoc(COL.benefits, b.id, { active: false, updatedAt: FieldValue.serverTimestamp() })));
  await patchDoc(COL.sponsors, req.params.id, {
    deletedAt: FieldValue.serverTimestamp(),
    updatedBy: req.user.id,
  });
  await logAudit(req, 'delete', `sponsors/${req.params.id}`, { name: doc.name });
  return noContent(res);
}));

export default r;

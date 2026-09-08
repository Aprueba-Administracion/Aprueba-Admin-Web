import { Router } from 'express';
import { ok, created, noContent, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, addDoc, patchDoc, deleteDoc, getDoc } from '../data/repo.js';

const r = Router();
const TIERS = ['Bronze', 'Silver', 'Gold'];

// Normaliza los beneficios que llegan del formulario. Si un beneficio ya
// existía (mismo id), conserva su `redeemed` — nunca se resetea un canje
// ya hecho solo por editar el sponsor.
function normalizeBenefits(input = [], previous = []) {
  const prevById = new Map(previous.map((b) => [b.id, b]));
  return input
    .map((b, i) => {
      const id = b.id || `b_${Date.now()}_${i}`;
      const prev = prevById.get(id);
      return {
        id,
        name: String(b.name || '').trim(),
        costPlatino: Math.max(0, Number(b.costPlatino) || 0),
        stock: Math.max(0, Number(b.stock) || 0),
        redeemed: prev ? prev.redeemed : 0,
      };
    })
    .filter((b) => b.name);
}

function totals(benefits = []) {
  return {
    benefitsOffered: benefits.reduce((a, b) => a + b.stock + b.redeemed, 0),
    benefitsRedeemed: benefits.reduce((a, b) => a + b.redeemed, 0),
  };
}

r.get('/sponsors', requireRole('finance'), wrap(async (_req, res) => {
  return ok(res, await listAll(COL.sponsors, 'name'));
}));

r.post('/sponsors', requireRole('finance'), wrap(async (req, res) => {
  const { name, tier, monthlyFee, benefits = [] } = req.body || {};
  if (!name) return fail(res, 400, 'VALIDATION', 'name es obligatorio');
  if (tier && !TIERS.includes(tier)) return fail(res, 400, 'VALIDATION', `tier debe ser uno de ${TIERS.join(', ')}`);
  const normalized = normalizeBenefits(benefits);
  const doc = await addDoc(COL.sponsors, {
    name, tier: tier || 'Bronze', monthlyFee: Number(monthlyFee || 0),
    benefits: normalized, status: 'ok',
    ...totals(normalized),
  });
  return created(res, doc);
}));

r.patch('/sponsors/:id', requireRole('finance'), wrap(async (req, res) => {
  const allowed = ['name', 'tier', 'monthlyFee', 'status'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  const doc = await patchDoc(COL.sponsors, req.params.id, patch);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  return ok(res, doc);
}));

// Reemplaza el catálogo de beneficios de un sponsor.
r.put('/sponsors/:id/benefits', requireRole('finance'), wrap(async (req, res) => {
  const current = await getDoc(COL.sponsors, req.params.id);
  if (!current) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const normalized = normalizeBenefits(req.body?.benefits || [], current.benefits || []);
  const doc = await patchDoc(COL.sponsors, req.params.id, {
    benefits: normalized,
    ...totals(normalized),
  });
  return ok(res, doc);
}));

// Registra el canje de un beneficio: baja stock, sube redeemed. Esta es la
// "conciliación" real de ofrecidos vs. cobrados.
r.post('/sponsors/:id/benefits/:benefitId/redeem', requireRole('finance'), wrap(async (req, res) => {
  const sponsor = await getDoc(COL.sponsors, req.params.id);
  if (!sponsor) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  const cantidad = Math.max(1, Number(req.body?.cantidad) || 1);
  const benefits = sponsor.benefits || [];
  const idx = benefits.findIndex((b) => b.id === req.params.benefitId);
  if (idx === -1) return fail(res, 404, 'NOT_FOUND', 'Beneficio no encontrado');
  if (benefits[idx].stock < cantidad) return fail(res, 400, 'VALIDATION', 'Stock insuficiente');
  benefits[idx] = {
    ...benefits[idx],
    stock: benefits[idx].stock - cantidad,
    redeemed: benefits[idx].redeemed + cantidad,
  };
  const doc = await patchDoc(COL.sponsors, req.params.id, { benefits, ...totals(benefits) });
  return ok(res, doc);
}));

r.delete('/sponsors/:id', requireRole('finance'), wrap(async (req, res) => {
  const doc = await getDoc(COL.sponsors, req.params.id);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Sponsor no encontrado');
  await deleteDoc(COL.sponsors, req.params.id);
  return noContent(res);
}));

export default r;
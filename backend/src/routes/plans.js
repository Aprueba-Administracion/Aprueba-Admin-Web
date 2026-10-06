import crypto from 'crypto';
import { Router } from 'express';
import { ok, created, noContent, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, db, listAll, getDoc, deleteDoc, countActiveSubscriptions } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();

// ── Modelo canónico de Max (plans/{planId} y features/{featureId}) ───────────
//   name {es,en} · nameLower · nameKey · price {monthly,yearly} · currency ·
//   color · features[] · limits · badges · system · published/popular/order ·
//   stripeProductId · stripePriceIds · createdAt/updatedAt · createdBy/updatedBy
// El API sigue ACEPTANDO el formato anterior (name string, price número) y
// también lo SIRVE normalizado aunque el documento aún no se haya migrado,
// así la consola funciona antes, durante y después de correr migrate:plans.

const SYSTEM_IDS = ['free', 'uni', 'all'];
const NAME_KEYS = { free: 'pl_free', uni: 'pl_uni', all: 'pl_all' };
const CURRENCIES = ['USD', 'CLP'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const iso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v ?? null);
const nameMap = (n) => (n && typeof n === 'object' ? { es: n.es ?? n.en ?? '', en: n.en ?? n.es ?? '' } : { es: String(n ?? ''), en: String(n ?? '') });
const priceMap = (p) => (p && typeof p === 'object'
  ? { monthly: Number(p.monthly ?? 0), yearly: p.yearly == null ? null : Number(p.yearly) }
  : { monthly: Number(p ?? 0), yearly: null });

// Vista canónica de un plan (sirve igual un doc ya migrado o uno viejo).
function canonicalPlan(d) {
  const name = nameMap(d.name);
  return {
    id: d.id,
    name,
    nameLower: d.nameLower || name.es.trim().toLowerCase(),
    nameKey: d.nameKey !== undefined ? d.nameKey : (NAME_KEYS[d.id] || null),
    price: priceMap(d.price),
    currency: d.currency || 'USD',
    color: d.color || '#6366F1',
    features: d.features || [],
    limits: d.limits || { qDay: 0, groups: 0, tests: 1 },
    badges: d.badges || { login: 0, purchase: 0, correct: 0 },
    system: d.system !== undefined ? !!d.system : SYSTEM_IDS.includes(d.id),
    published: d.published !== undefined ? !!d.published : true,
    popular: !!d.popular,
    order: d.order ?? null,
    stripeProductId: d.stripeProductId ?? null,
    stripePriceIds: d.stripePriceIds || { monthly: null, yearly: null },
    createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt),
    createdBy: d.createdBy ?? null, updatedBy: d.updatedBy ?? null,
  };
}

function canonicalFeature(d) {
  return {
    id: d.id,
    key: d.key || null,
    name: d.name && typeof d.name === 'object' ? d.name : { es: d.name_es || '', en: d.name_en || d.name_es || '' },
    description: d.description ?? null,
    icon: d.icon ?? d.ic ?? '',
    order: d.order ?? null,
    active: d.active !== false,
  };
}

const bad = (res, msg) => fail(res, 400, 'VALIDATION', msg);
const intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Valida y normaliza el cuerpo de un plan. `base` = valores actuales (PUT) o defaults (POST).
async function buildFields(body, base) {
  const out = {};
  if (body.name !== undefined) {
    const name = nameMap(body.name);
    for (const k of ['es', 'en']) {
      const v = name[k].trim();
      if (v.length < 2 || v.length > 60) return { error: `name.${k} debe tener entre 2 y 60 caracteres` };
      name[k] = v;
    }
    out.name = name; out.nameLower = name.es.toLowerCase();
  }
  if (body.price !== undefined) {
    const p = priceMap(body.price);
    if (!Number.isFinite(p.monthly) || p.monthly < 0) return { error: 'price.monthly debe ser un número ≥ 0' };
    if (p.yearly != null && (!Number.isFinite(p.yearly) || p.yearly < 0)) return { error: 'price.yearly debe ser un número ≥ 0 o null' };
    // Si solo llega el mensual (número plano, formato anterior), se conserva el anual actual.
    const keepYearly = typeof body.price !== 'object' ? base.price.yearly : p.yearly;
    out.price = { monthly: round2(p.monthly), yearly: keepYearly == null ? null : round2(keepYearly) };
  }
  if (body.currency !== undefined) {
    if (!CURRENCIES.includes(body.currency)) return { error: `currency debe ser ${CURRENCIES.join(' o ')}` };
    out.currency = body.currency;
  }
  if (body.color !== undefined) {
    if (!HEX.test(body.color)) return { error: 'color debe ser hexadecimal #RRGGBB' };
    out.color = body.color;
  }
  if (body.features !== undefined) {
    const f = body.features;
    if (!Array.isArray(f) || f.length > 20 || new Set(f).size !== f.length) return { error: 'features debe ser una lista sin duplicados de hasta 20 ids' };
    const known = new Set((await listAll(COL.features)).map((x) => x.id));
    const unknown = f.filter((id) => !known.has(id));
    if (unknown.length) return { error: `features desconocidas: ${unknown.join(', ')}` };
    out.features = f;
  }
  if (body.limits !== undefined) {
    const l = { qDay: Number(body.limits.qDay ?? 0), groups: Number(body.limits.groups ?? 0), tests: Number(body.limits.tests ?? 1) };
    if (!intIn(l.qDay, 0, 10000) || !intIn(l.groups, 0, 100) || !intIn(l.tests, 0, 99)) {
      return { error: 'limits fuera de rango (qDay 0–10000, groups 0–100, tests 0–99)' };
    }
    out.limits = l;
  }
  if (body.badges !== undefined) {
    const b = { login: Number(body.badges.login ?? 0), purchase: Number(body.badges.purchase ?? 0), correct: Number(body.badges.correct ?? 0) };
    if (!intIn(b.login, 0, 100) || !intIn(b.purchase, 0, 1000) || !intIn(b.correct, 0, 100)) {
      return { error: 'badges fuera de rango (login 0–100, purchase 0–1000, correct 0–100)' };
    }
    out.badges = b;
  }
  return { fields: out };
}

async function nameTaken(nameLower, exceptId) {
  const snap = await db.collection(COL.plans).where('nameLower', '==', nameLower).limit(2).get();
  return snap.docs.some((d) => d.id !== exceptId);
}

// GET /admin/features — catálogo de funcionalidades
r.get('/features', requireRole('admin'), wrap(async (_req, res) => {
  const rows = (await listAll(COL.features)).map(canonicalFeature).filter((f) => f.active);
  rows.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  return ok(res, rows);
}));

// GET /admin/plans — orden en memoria: free, uni, all y luego por creación
r.get('/plans', requireRole('admin'), wrap(async (_req, res) => {
  const rows = (await listAll(COL.plans)).map(canonicalPlan);
  const rank = (p) => { const i = SYSTEM_IDS.indexOf(p.id); return i === -1 ? 100 : i; };
  rows.sort((a, b) => rank(a) - rank(b) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return ok(res, rows);
}));

// POST /admin/plans
r.post('/plans', requireRole('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return bad(res, 'name es obligatorio');
  const defaults = { price: { monthly: 0, yearly: null } };
  const { fields, error } = await buildFields({
    currency: 'USD', color: '#6366F1', features: [], limits: { qDay: 0, groups: 0, tests: 1 },
    badges: { login: 0, purchase: 0, correct: 0 }, ...b,
  }, defaults);
  if (error) return bad(res, error);
  if (!fields.price) fields.price = { monthly: 0, yearly: null };
  if (await nameTaken(fields.nameLower, null)) return fail(res, 409, 'PLAN_NAME_TAKEN', 'Ya existe un plan con ese nombre');

  const all = await listAll(COL.plans);
  const id = `pl_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date();
  const doc = {
    ...fields, nameKey: null, system: false, published: true, popular: false,
    order: Math.max(0, ...all.map((p) => p.order || 0)) + 1,
    stripeProductId: null, stripePriceIds: { monthly: null, yearly: null },
    createdAt: now, updatedAt: now, createdBy: req.user.id, updatedBy: req.user.id,
  };
  await db.collection(COL.plans).doc(id).set(doc);
  await logAudit(req, 'create', `plans/${id}`, { name: doc.name, price: doc.price });
  return created(res, canonicalPlan({ id, ...doc }));
}));

// PUT /admin/plans/:id — guardar cambios del constructor.
// Concurrencia optimista: si el cuerpo trae `updatedAt` y ya no coincide con el
// guardado, responde 409 PLAN_CONFLICT (otro admin lo editó mientras tanto).
r.put('/plans/:id', requireRole('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  const existingRaw = await getDoc(COL.plans, req.params.id);
  if (!existingRaw) return fail(res, 404, 'NOT_FOUND', 'Plan no encontrado');
  const existing = canonicalPlan(existingRaw);
  if (b.updatedAt && existing.updatedAt && b.updatedAt !== existing.updatedAt) {
    return fail(res, 409, 'PLAN_CONFLICT', 'El plan fue modificado por otra persona. Recarga y vuelve a intentar.');
  }
  const { fields, error } = await buildFields(b, existing);
  if (error) return bad(res, error);
  const next = { ...fields };
  const finalPrice = next.price || existing.price;
  if (req.params.id === 'free' && finalPrice.monthly !== 0) {
    return fail(res, 422, 'FREE_PLAN_MUST_BE_FREE', 'El plan gratuito debe mantener precio 0');
  }
  if (next.nameLower && await nameTaken(next.nameLower, req.params.id)) {
    return fail(res, 409, 'PLAN_NAME_TAKEN', 'Ya existe un plan con ese nombre');
  }
  // Un doc anterior a la migración se completa al guardarlo (migración perezosa).
  const merged = { ...existing, ...next, updatedAt: new Date(), updatedBy: req.user.id };
  delete merged.id;
  merged.createdAt = existingRaw.createdAt || new Date();
  // El set SIN merge reemplaza el documento: así desaparecen los campos legados.
  await db.collection(COL.plans).doc(req.params.id).set(merged);
  await logAudit(req, 'update', `plans/${req.params.id}`, { name: merged.name, price: merged.price });
  // Nota: un cambio de price.monthly se sincronizaría aquí con Stripe (stripePriceIds.monthly).
  return ok(res, canonicalPlan({ id: req.params.id, ...merged }));
}));

// DELETE /admin/plans/:id — no permitido en planes de sistema ni con suscripciones activas
r.delete('/plans/:id', requireRole('admin'), wrap(async (req, res) => {
  const raw = await getDoc(COL.plans, req.params.id);
  if (!raw) return fail(res, 404, 'NOT_FOUND', 'Plan no encontrado');
  const doc = canonicalPlan(raw);
  if (doc.system) return fail(res, 422, 'PLAN_PROTECTED', 'Los planes de sistema (gratis, 1 prueba, todas) no se pueden eliminar');
  const active = await countActiveSubscriptions(req.params.id);
  if (active > 0) return fail(res, 409, 'PLAN_HAS_SUBSCRIPTIONS', `No se puede eliminar: ${active} suscripciones activas`);
  await deleteDoc(COL.plans, req.params.id);
  await logAudit(req, 'delete', `plans/${req.params.id}`, { name: doc.name });
  return noContent(res);
}));

export default r;

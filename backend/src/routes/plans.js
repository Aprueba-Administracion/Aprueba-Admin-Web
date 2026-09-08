import { Router } from 'express';
import { ok, created, noContent, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, addDoc, patchDoc, setDoc, getDoc, deleteDoc, countActiveSubscriptions } from '../data/repo.js';

const r = Router();

// Normaliza límites y badges por acción a enteros >= 0.
const intN = (v, d = 0) => Math.max(0, parseInt(v ?? d, 10) || 0);
function normLimits(l = {}) {
  return { qDay: intN(l.qDay), groups: intN(l.groups), tests: intN(l.tests, 1) };
}
// badges por acción: login diario, compra del plan, por respuesta correcta diaria
function normBadges(b = {}) {
  return { login: intN(b.login), purchase: intN(b.purchase), correct: intN(b.correct) };
}

// GET /admin/features — catálogo de funcionalidades
r.get('/features', requireRole('admin'), wrap(async (_req, res) => {
  return ok(res, await listAll(COL.features));
}));

// GET /admin/plans
r.get('/plans', requireRole('admin'), wrap(async (_req, res) => {
  return ok(res, await listAll(COL.plans));
}));

// POST /admin/plans
r.post('/plans', requireRole('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.name) return fail(res, 400, 'VALIDATION', 'name es obligatorio');
  const doc = await addDoc(COL.plans, {
    name: b.name,
    price: Number(b.price || 0),
    color: b.color || '#6366F1',
    features: Array.isArray(b.features) ? b.features : [],
    limits: normLimits(b.limits),
    badges: normBadges(b.badges),
  });
  return created(res, doc);
}));

// PUT /admin/plans/:id — guardar cambios del constructor (features, límites y badges por acción)
r.put('/plans/:id', requireRole('admin'), wrap(async (req, res) => {
  const b = req.body || {};
  const existing = await getDoc(COL.plans, req.params.id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Plan no encontrado');
  const next = {
    name: b.name ?? existing.name,
    price: b.price != null ? Number(b.price) : existing.price,
    color: b.color ?? existing.color,
    features: Array.isArray(b.features) ? b.features : existing.features,
    limits: b.limits ? normLimits(b.limits) : existing.limits,
    badges: b.badges ? normBadges(b.badges) : (existing.badges || normBadges()),
  };
  const doc = await setDoc(COL.plans, req.params.id, next);
  // Nota: un cambio de price se sincronizaría aquí con los precios de Stripe.
  return ok(res, doc);
}));

// DELETE /admin/plans/:id — no permitido si hay suscripciones activas
r.delete('/plans/:id', requireRole('admin'), wrap(async (req, res) => {
  const doc = await getDoc(COL.plans, req.params.id);
  if (!doc) return fail(res, 404, 'NOT_FOUND', 'Plan no encontrado');
  const active = await countActiveSubscriptions(req.params.id);
  if (active > 0) return fail(res, 409, 'PLAN_HAS_SUBSCRIPTIONS', `No se puede eliminar: ${active} suscripciones activas`);
  await deleteDoc(COL.plans, req.params.id);
  return noContent(res);
}));

export default r;

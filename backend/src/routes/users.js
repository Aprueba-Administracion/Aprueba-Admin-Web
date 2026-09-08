import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc, patchDoc } from '../data/repo.js';

const r = Router();

// GET /admin/users (admin/support) — búsqueda + paginación por cursor simple
r.get('/users', requireRole('support'), wrap(async (req, res) => {
  const { q, plan, state, limit = 20, cursor } = req.query;
  let rows = await listAll(COL.users, 'name');
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((u) => u.name?.toLowerCase().includes(needle) || u.email?.toLowerCase().includes(needle));
  }
  if (plan) rows = rows.filter((u) => u.plan === plan);
  if (state) rows = rows.filter((u) => u.state === state);
  const total = rows.length;
  const start = cursor ? Number(Buffer.from(String(cursor), 'base64').toString('utf8')) || 0 : 0;
  const lim = Math.min(Number(limit) || 20, 100);
  const page = rows.slice(start, start + lim);
  const next = start + lim < total ? Buffer.from(String(start + lim)).toString('base64') : null;
  return ok(res, page, 200, { pagination: { total, nextCursor: next } });
}));

// GET /admin/users/:id (admin/support)
r.get('/users/:id', requireRole('support'), wrap(async (req, res) => {
  const u = await getDoc(COL.users, req.params.id);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
  return ok(res, u);
}));

// PATCH /admin/users/:id (admin/support) — suspender/reactivar/cambiar correo/plan
r.patch('/users/:id', requireRole('support'), wrap(async (req, res) => {
  const allowed = ['state', 'email', 'plan'];
  const patch = {};
  for (const k of allowed) if (k in (req.body || {})) patch[k] = req.body[k];
  if (req.body?.reason) patch.lastActionReason = req.body.reason;
  patch.auditedBy = req.user.id;
  patch.auditedAt = new Date().toISOString();
  const u = await patchDoc(COL.users, req.params.id, patch);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
  return ok(res, u);
}));

export default r;

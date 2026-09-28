import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc, patchDoc } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();

// El rótulo "hoy"/"ayer"/"N d" de la ficha NO se guarda (modelo canónico de
// Max: solo se persiste lastActiveAt/lastActiveDate); se calcula acá igual
// que `age` en supportTickets (ver withAge en routes/tickets.js).
function withActivity(u) {
  if (!u.lastActiveAt) return { ...u, lastActiveLabel: u.lastActiveDate || null };
  const then = new Date(u.lastActiveAt);
  const now = new Date();
  const days = Math.floor((now - then) / 86400000);
  const label = then.toDateString() === now.toDateString() ? 'hoy'
    : days === 1 ? 'ayer'
    : `${days} d`;
  return { ...u, lastActiveLabel: label };
}

// GET /admin/users (admin/support) — búsqueda + paginación por cursor simple
r.get('/users', requireRole('support'), wrap(async (req, res) => {
  const { q, plan, state, limit = 20, cursor } = req.query;
  let rows = await listAll(COL.users, 'nameLower');
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((u) => (u.nameLower || '').includes(needle) || (u.emailLower || '').includes(needle));
  }
  if (plan) rows = rows.filter((u) => u.plan === plan);
  if (state) rows = rows.filter((u) => u.state === state);
  const total = rows.length;
  const start = cursor ? Number(Buffer.from(String(cursor), 'base64').toString('utf8')) || 0 : 0;
  const lim = Math.min(Number(limit) || 20, 100);
  const page = rows.slice(start, start + lim).map(withActivity);
  const next = start + lim < total ? Buffer.from(String(start + lim)).toString('base64') : null;
  return ok(res, page, 200, { pagination: { total, nextCursor: next } });
}));

// GET /admin/users/stats (admin/support) — conteos globales para los KPI de
// la consola (antes se calculaban en el frontend solo sobre la página
// cargada, lo que subcontaba si había más de una página de usuarios).
r.get('/users/stats', requireRole('support'), wrap(async (req, res) => {
  const all = await listAll(COL.users);
  const stats = {
    total: all.length,
    active: all.filter((u) => u.state === 'active').length,
    suspended: all.filter((u) => u.state === 'suspended').length,
    churned: all.filter((u) => u.state === 'churned').length,
  };
  return ok(res, stats);
}));

// GET /admin/users/:id (admin/support)
r.get('/users/:id', requireRole('support'), wrap(async (req, res) => {
  const u = await getDoc(COL.users, req.params.id);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
  return ok(res, withActivity(u));
}));

// PATCH /admin/users/:id (admin/support) — suspender/reactivar, fijar plan
// manualmente, dejar un correo pendiente de verificación o forzar el cierre
// de sesiones. Al pie de la letra del modelo de Max: la consola YA NO
// escribe el `email` real del alumno (es un espejo de Firebase Auth), solo
// `pendingEmail`; y el rastro de auditoría queda en un único mapa
// `lastAdminAction` (reemplaza los campos sueltos auditedBy/auditedAt/
// lastActionReason que usaba la versión anterior).
r.patch('/users/:id', requireRole('support'), wrap(async (req, res) => {
  const body = req.body || {};
  const before = await getDoc(COL.users, req.params.id);
  if (!before) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado');

  const now = new Date().toISOString();
  const patch = { updatedAt: now };
  let action = null;

  if ('state' in body && body.state !== before.state) {
    patch.state = body.state;
    patch.stateChangedAt = now;
    if (body.state === 'suspended') {
      patch.suspension = { reason: body.reason || null, by: req.user.id, at: now };
      patch.sessionsRevokedAt = now;
      action = 'suspend';
    } else {
      patch.suspension = null;
      action = body.state === 'active' ? 'reactivate' : 'update_state';
    }
  }
  if ('plan' in body && body.plan !== before.plan) {
    patch.plan = body.plan;
    // Fijar el plan a mano marca planSource=manual para que el sincronizador
    // de Stripe no lo pise después (ver modelo.txt, users/{uid}.planSource).
    patch.planSource = body.planSource || 'manual';
    action = action || 'update_plan';
  }
  if ('pendingEmail' in body) {
    patch.pendingEmail = body.pendingEmail || null;
    action = action || 'set_pending_email';
  }
  if (body.forceLogout) {
    patch.sessionsRevokedAt = now;
    action = action || 'force_logout';
  }
  if (action) {
    patch.lastAdminAction = { action, reason: body.reason || null, by: req.user.id, at: now };
  }

  const u = await patchDoc(COL.users, req.params.id, patch);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'Usuario no encontrado');
  await logAudit(req, 'update', `users/${req.params.id}`, patch);
  return ok(res, withActivity(u));
}));

export default r;

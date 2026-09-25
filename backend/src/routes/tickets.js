import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc, listSub, subDocRef, patchSubAll, db, FieldValue } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();

// Transiciones de estado permitidas por el modelo de Max: progress→open NO
// está permitida (reabrir un ticket solo aplica desde closed).
const TRANSITIONS = new Set(['open>progress', 'open>closed', 'progress>closed', 'closed>open']);

// La antigüedad ("2 h", "1 d") se calcula acá a partir de createdAt/closedAt;
// no se persiste en el documento (así lo pide el modelo canónico).
function withAge(t) {
  const end = t.status === 'closed' && t.closedAt ? new Date(t.closedAt) : new Date();
  const start = new Date(t.createdAt);
  const secs = Math.max(0, Math.round((end - start) / 1000));
  const h = Math.floor(secs / 3600);
  const ageLabel = h < 1 ? '< 1 h' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
  return { ...t, ageSeconds: secs, ageLabel, age: ageLabel };
}

r.get('/tickets', requireRole('support'), wrap(async (req, res) => {
  const all = await listAll(COL.tickets);
  const openCount = all.filter((t) => t.status === 'open' || t.status === 'progress').length;

  let rows = all;
  if (req.query.status) rows = rows.filter((t) => t.status === req.query.status);
  if (req.query.priority) rows = rows.filter((t) => t.priority === req.query.priority);
  if (req.query.assigneeId) {
    rows = req.query.assigneeId === 'unassigned'
      ? rows.filter((t) => !t.assigneeId)
      : rows.filter((t) => t.assigneeId === req.query.assigneeId);
  }
  if (req.query.userId) rows = rows.filter((t) => t.userId === req.query.userId);
  if (req.query.q) {
    const num = String(req.query.q).replace(/^#/, '');
    rows = /^\d+$/.test(num)
      ? rows.filter((t) => String(t.number) === num)
      : rows.filter((t) => (t.subjectLower || '').startsWith(String(req.query.q).toLowerCase()));
  }
  const sorters = {
    createdAt: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    '-createdAt': (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    '-updatedAt': (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
    priority: (a, b) => (a.priorityRank ?? 9) - (b.priorityRank ?? 9),
  };
  rows = rows.slice().sort(sorters[req.query.sort] || sorters.createdAt).map(withAge);

  return ok(res, rows, 200, { openCount });
}));

r.get('/tickets/:id', requireRole('support'), wrap(async (req, res) => {
  const t = await getDoc(COL.tickets, req.params.id);
  if (!t) return fail(res, 404, 'NOT_FOUND', 'Ticket no encontrado');
  const messages = await listSub(COL.tickets, req.params.id, 'messages', 'createdAt', 200);
  return ok(res, { ...withAge(t), messages });
}));

r.patch('/tickets/:id', requireRole('support'), wrap(async (req, res) => {
  const { status, priority, assigneeId, reply, internalNote } = req.body || {};
  if (!Object.keys(req.body || {}).length) return fail(res, 400, 'VALIDATION', 'El cuerpo no puede estar vacío');

  const before = await getDoc(COL.tickets, req.params.id);
  if (!before) return fail(res, 404, 'NOT_FOUND', 'Ticket no encontrado');

  const ref = db.collection(COL.tickets).doc(req.params.id);
  const batch = db.batch();
  const upd = { updatedAt: new Date().toISOString() };
  let newMsgs = 0;

  if ('assigneeId' in (req.body || {})) {
    if (assigneeId === null || assigneeId === '') {
      upd.assigneeId = null; upd.assigneeName = null;
    } else {
      const agent = await getDoc(COL.adminUsers, assigneeId);
      if (!agent || !['support', 'admin'].includes(agent.role)) {
        return fail(res, 422, 'ASSIGNEE_INVALID', 'El agente indicado no existe o no puede recibir tickets.');
      }
      upd.assigneeId = agent.id; upd.assigneeName = agent.name;
    }
  }

  if (priority) { upd.priority = priority; upd.priorityRank = { high: 0, med: 1, low: 2 }[priority]; }

  // Si llega `reply` sobre un ticket abierto y no se pidió cambio de estado,
  // pasa automáticamente a `progress` (igual que el documento de endpoints).
  let targetStatus = status;
  if (reply && before.status === 'open' && !targetStatus) targetStatus = 'progress';

  if (targetStatus && targetStatus !== before.status) {
    if (!TRANSITIONS.has(`${before.status}>${targetStatus}`)) {
      return fail(res, 409, 'INVALID_STATE_TRANSITION', `No es posible pasar de ${before.status} a ${targetStatus}`);
    }
    upd.status = targetStatus;
    const now = new Date().toISOString();
    upd.closedAt = targetStatus === 'closed' ? now : null;
    if (before.status === 'closed' && targetStatus === 'open') {
      // Reapertura: mensaje de sistema + se limpia el TTL de los mensajes existentes.
      batch.set(subDocRef(COL.tickets, req.params.id, 'messages'), {
        authorType: 'system', authorId: null, authorName: 'Sistema',
        body: 'Ticket reabierto', internal: false, createdAt: now, expiresAt: null,
      });
      newMsgs += 1;
    }
  }

  if (reply && reply.trim()) {
    if (!before.assigneeId && !('assigneeId' in upd)) { upd.assigneeId = req.user.id; upd.assigneeName = req.user.name; }
    batch.set(subDocRef(COL.tickets, req.params.id, 'messages'), {
      authorType: 'agent', authorId: req.user.id, authorName: req.user.name,
      body: reply.trim(), internal: false, createdAt: new Date().toISOString(), expiresAt: null,
    });
    newMsgs += 1;
  }
  if (internalNote && internalNote.trim()) {
    batch.set(subDocRef(COL.tickets, req.params.id, 'messages'), {
      authorType: 'agent', authorId: req.user.id, authorName: req.user.name,
      body: internalNote.trim(), internal: true, createdAt: new Date().toISOString(), expiresAt: null,
    });
    newMsgs += 1;
  }
  if (newMsgs) { upd.messagesCount = FieldValue.increment(newMsgs); upd.lastMessageAt = new Date().toISOString(); }

  batch.set(ref, upd, { merge: true });
  await batch.commit();

  // TTL: al cerrar, todos los mensajes del hilo (incluidos los recién
  // creados en este mismo PATCH) expiran a closedAt + 2 años.
  if (upd.status === 'closed') {
    const expiresAt = new Date(new Date(upd.closedAt).getTime() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    await patchSubAll(COL.tickets, req.params.id, 'messages', { expiresAt });
  }

  const t = await getDoc(COL.tickets, req.params.id);
  await logAudit(req, 'update', `tickets/${req.params.id}`, { ...upd, messagesCount: undefined });
  return ok(res, withAge(t));
}));

export default r;

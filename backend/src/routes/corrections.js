import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc, patchDoc } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();
// Recompensa fija (regla global, no por plan) — modelo de Max: potentialReward.
const CONFIRM_REWARD = { tier: 'bronze', amount: 250 };

r.get('/corrections', requireRole('support'), wrap(async (req, res) => {
  const all = await listAll(COL.corrections);
  const pendingCount = all.filter((c) => (c.status || 'pending') === 'pending').length;
  let rows = all;
  if (req.query.status && req.query.status !== 'all') rows = rows.filter((c) => (c.status || 'pending') === req.query.status);
  rows = rows.slice().sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  return ok(res, rows, 200, { pendingCount });
}));

// PATCH /admin/corrections/:id — confirmar otorga 250 medallas de bronce al alumno
r.patch('/corrections/:id', requireRole('support'), wrap(async (req, res) => {
  const { resolution, questionPatch, note } = req.body || {};
  if (!['confirmed', 'rejected'].includes(resolution)) {
    return fail(res, 400, 'VALIDATION', "resolution debe ser 'confirmed' o 'rejected'");
  }
  const cor = await getDoc(COL.corrections, req.params.id);
  if (!cor) return fail(res, 404, 'NOT_FOUND', 'Solicitud no encontrada');
  if ((cor.status || 'pending') !== 'pending') {
    return fail(res, 409, 'ALREADY_RESOLVED', 'Esta solicitud ya fue resuelta');
  }

  let rewardGranted = null;
  const patch = {
    status: resolution,
    resolvedBy: req.user.id,
    resolvedByName: req.user.name,
    resolvedAt: new Date().toISOString(),
    note: note?.trim() || null,
  };

  if (resolution === 'confirmed') {
    // Otorga recompensa al alumno y, opcionalmente, corrige la pregunta.
    const user = await getDoc(COL.users, cor.userId);
    if (user) {
      await patchDoc(COL.users, cor.userId, { badges: (user.badges || 0) + CONFIRM_REWARD.amount });
      rewardGranted = { userId: cor.userId, ...CONFIRM_REWARD };
    }
    if (questionPatch && cor.questionId) {
      await patchDoc(COL.questions, cor.questionId, {
        ...questionPatch,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id,
        lastCorrectionId: req.params.id,
        correctionsCount: (await getDoc(COL.questions, cor.questionId))?.correctionsCount + 1 || 1,
      });
    }
  }
  patch.rewardGranted = rewardGranted;

  await patchDoc(COL.corrections, req.params.id, patch);
  await logAudit(req, resolution, `corrections/${req.params.id}`, { rewardGranted, note: patch.note, questionPatch });
  return ok(res, { id: req.params.id, ...patch });
}));

export default r;

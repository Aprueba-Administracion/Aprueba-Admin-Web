import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, getDoc, patchDoc } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();
const CONFIRM_REWARD = { tier: 'bronze', amount: 250 };

r.get('/corrections', requireRole('support'), wrap(async (req, res) => {
  let rows = await listAll(COL.corrections);
  if (req.query.state) rows = rows.filter((c) => c.state === req.query.state);
  return ok(res, rows);
}));

// PATCH /admin/corrections/:id — confirmar otorga 250 medallas de bronce al alumno
r.patch('/corrections/:id', requireRole('support'), wrap(async (req, res) => {
  const { resolution, questionPatch } = req.body || {};
  if (!['confirmed', 'rejected'].includes(resolution)) {
    return fail(res, 400, 'VALIDATION', "resolution debe ser 'confirmed' o 'rejected'");
  }
  const cor = await getDoc(COL.corrections, req.params.id);
  if (!cor) return fail(res, 404, 'NOT_FOUND', 'Solicitud no encontrada');

  await patchDoc(COL.corrections, req.params.id, { state: resolution, resolvedBy: req.user.id, resolvedAt: new Date().toISOString() });

  let rewardGranted = null;
  if (resolution === 'confirmed') {
    // Otorga recompensa al alumno y, opcionalmente, corrige la pregunta.
    const user = await getDoc(COL.users, cor.userId);
    if (user) {
      await patchDoc(COL.users, cor.userId, { badges: (user.badges || 0) + CONFIRM_REWARD.amount });
    }
    if (questionPatch && cor.questionId) {
      await patchDoc(COL.questions, cor.questionId, questionPatch);
    }
    rewardGranted = { userId: cor.userId, ...CONFIRM_REWARD };
  }
  await logAudit(req, resolution, `corrections/${req.params.id}`, { rewardGranted });
  return ok(res, { id: req.params.id, state: resolution, rewardGranted });
}));

export default r;

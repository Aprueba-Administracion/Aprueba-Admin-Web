import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, db, FieldValue } from '../data/repo.js';
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
  const corRef = db.collection(COL.corrections).doc(req.params.id);
  const basePatch = {
    status: resolution,
    resolvedBy: req.user.id,
    resolvedByName: req.user.name,
    resolvedAt: new Date().toISOString(),
    note: note?.trim() || null,
  };

  // Todo en UNA transacción (modelo de Max, #4): corrección + saldo del
  // alumno (medals/badgesTotal) + asiento en users/{uid}/medalLedger +
  // parche de la pregunta. Así el saldo y el ledger nunca quedan
  // desincronizados, y dos admins no pueden resolver la misma solicitud.
  const result = await db.runTransaction(async (tx) => {
    const corSnap = await tx.get(corRef);
    if (!corSnap.exists) return { error: [404, 'NOT_FOUND', 'Solicitud no encontrada'] };
    const cor = { id: corSnap.id, ...corSnap.data() };
    if ((cor.status || 'pending') !== 'pending') {
      return { error: [409, 'ALREADY_RESOLVED', 'Esta solicitud ya fue resuelta'] };
    }

    let rewardGranted = null;
    let userRef = null;
    let user = null;
    if (resolution === 'confirmed' && cor.userId) {
      userRef = db.collection(COL.users).doc(cor.userId);
      const uSnap = await tx.get(userRef);
      if (uSnap.exists) user = uSnap.data();
    }

    // --- escrituras (todas las lecturas ya terminaron) ---
    const patch = { ...basePatch };
    if (user) {
      const now = new Date().toISOString();
      const medals = { bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0, ...(user.medals || {}) };
      medals.bronze += CONFIRM_REWARD.amount;
      tx.set(userRef, {
        medals,
        badgesTotal: (user.badgesTotal || 0) + CONFIRM_REWARD.amount,
        updatedAt: now,
      }, { merge: true });
      const ledgerRef = userRef.collection('medalLedger').doc();
      tx.set(ledgerRef, {
        event: 'reward',
        tier: CONFIRM_REWARD.tier,
        amount: CONFIRM_REWARD.amount,
        reason: 'correction_confirmed',
        refType: 'correction',
        refId: cor.id,
        by: req.user.id,
        createdAt: now,
      });
      rewardGranted = { userId: cor.userId, ...CONFIRM_REWARD, ledgerId: ledgerRef.id };
    }
    if (resolution === 'confirmed' && questionPatch && cor.questionId) {
      tx.set(db.collection(COL.questions).doc(cor.questionId), {
        ...questionPatch,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.id,
        lastCorrectionId: cor.id,
        correctionsCount: FieldValue.increment(1),
      }, { merge: true });
    }
    patch.rewardGranted = rewardGranted;
    tx.set(corRef, patch, { merge: true });
    return { patch, rewardGranted };
  });

  if (result.error) return fail(res, ...result.error);
  await logAudit(req, resolution, `corrections/${req.params.id}`, {
    rewardGranted: result.rewardGranted, note: result.patch.note, questionPatch,
  });
  return ok(res, { id: req.params.id, ...result.patch });
}));

export default r;

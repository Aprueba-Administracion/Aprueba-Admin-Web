import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Timestamp } from 'firebase-admin/firestore';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { authRequired } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';
import {
  signAccess,
  signRefresh,
  verify,
  REFRESH_TTL,
} from '../lib/jwt.js';
import {
  COL,
  db,
  FieldValue,
  listAll,
  getDoc,
} from '../data/repo.js';

const r = Router();

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime() || 0;
};

// Evita usar valores inválidos del token como rutas de Firestore.
const validId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/') &&
  Buffer.byteLength(value, 'utf8') <= 1500;

async function findAdminByEmail(email) {
  const lower = String(email).trim().toLowerCase();

  const snap = await db.collection(COL.adminUsers)
    .where('emailLower', '==', lower)
    .limit(1)
    .get();

  if (!snap.empty) {
    return {
      ...snap.docs[0].data(),
      id: snap.docs[0].id,
    };
  }

  const all = await listAll(COL.adminUsers);

  return all.find(
    (user) => user.email?.toLowerCase() === lower
  ) || null;
}

const touchAdmin = (id, patch) =>
  db.collection(COL.adminUsers)
    .doc(id)
    .set(patch, { merge: true });

const pubOf = (user) => ({
  id: user.id,
  name: user.name,
  role: user.role,
  email: user.email,
});

// Login: valida credenciales y crea una sesión nueva.
r.post('/auth/login', wrap(async (req, res) => {
  const { email, password, otp } = req.body || {};

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return fail(
      res, 400, 'VALIDATION',
      'email y password son obligatorios'
    );
  }

  const user = await findAdminByEmail(email);

  if (!user) {
    return fail(
      res, 401, 'AUTH_INVALID_CREDENTIALS',
      'Credenciales inválidas'
    );
  }

  if (toMillis(user.lockedUntil) > Date.now()) {
    return fail(
      res, 423, 'ACCOUNT_LOCKED',
      `Cuenta bloqueada temporalmente por intentos fallidos. Reintenta en ${LOCK_MINUTES} minutos.`
    );
  }

  const match = await bcrypt.compare(
    password,
    user.passwordHash || ''
  );

  if (!match) {
    const failed = (user.failedLoginCount || 0) + 1;

    const patch = {
      failedLoginCount: failed,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (failed >= MAX_FAILED) {
      patch.lockedUntil = Timestamp.fromMillis(
        Date.now() + LOCK_MINUTES * 60 * 1000
      );
    }

    await touchAdmin(user.id, patch);

    return fail(
      res, 401, 'AUTH_INVALID_CREDENTIALS',
      'Credenciales inválidas'
    );
  }

  if (user.active === false) {
    return fail(
      res, 403, 'ACCOUNT_DISABLED',
      'Cuenta deshabilitada. Contacta a un administrador.'
    );
  }

  // Se conserva el MFA de demostración de tu implementación.
  if (user.mfaEnabled && otp !== '123456') {
    return fail(
      res, 401, 'AUTH_MFA_REQUIRED',
      'Se requiere código MFA válido (demo: 123456)'
    );
  }

  const pub = pubOf(user);
  const sessionRef = db.collection(COL.adminSessions).doc();

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(
    now.toMillis() + REFRESH_TTL * 1000
  );

  const accessToken = signAccess(pub, sessionRef.id);
  const refreshToken = signRefresh(pub, sessionRef.id);

  // Crea la sesión y actualiza el administrador atómicamente.
  const batch = db.batch();

  batch.set(sessionRef, {
    adminId: user.id,
    createdAt: now,
    expiresAt,
    revokedAt: null,
    revokedBy: null,
  });

  batch.set(
    db.collection(COL.adminUsers).doc(user.id),
    {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await batch.commit();

  return ok(res, {
    user: pub,
    accessToken,
    refreshToken,
  });
}));

// Refresh: solo permite renovar una sesión vigente y no revocada.
r.post('/auth/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};

  if (typeof refreshToken !== 'string' || !refreshToken) {
    return fail(
      res, 400, 'VALIDATION',
      'refreshToken es obligatorio'
    );
  }

  let payload;

  try {
    payload = verify(refreshToken);
  } catch {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Refresh token inválido o expirado'
    );
  }

  if (
    payload.typ !== 'refresh' ||
    !validId(payload.sub) ||
    !validId(payload.sid)
  ) {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Token sin sesión válida. Inicia sesión nuevamente.'
    );
  }

  const sessionSnap = await db.collection(COL.adminSessions)
    .doc(payload.sid)
    .get();

  const session = sessionSnap.exists
    ? sessionSnap.data()
    : null;

  if (
    !session ||
    (session.adminId ?? session.userId) !== payload.sub ||
    session.revokedAt != null ||
    toMillis(session.expiresAt) <= Date.now()
  ) {
    return fail(
      res, 401, 'AUTH_SESSION_INVALID',
      'La sesión expiró o fue cerrada. Inicia sesión nuevamente.'
    );
  }

  const user = await getDoc(COL.adminUsers, payload.sub);

  if (!user) {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Usuario no encontrado'
    );
  }

  if (user.active === false) {
    return fail(
      res, 403, 'ACCOUNT_DISABLED',
      'Cuenta deshabilitada. Contacta a un administrador.'
    );
  }

  const pub = pubOf({ ...user, id: payload.sub });

  // Renueva tokens, pero conserva la fecha límite de la sesión.
  return ok(res, {
    accessToken: signAccess(pub, payload.sid),
    refreshToken: signRefresh(pub, payload.sid),
  });
}));

// Logout: recibe el refresh token y revoca su sesión.
// Funciona aunque el access token ya haya expirado.
r.post('/auth/logout', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};

  if (typeof refreshToken !== 'string' || !refreshToken) {
    return fail(
      res, 400, 'VALIDATION',
      'refreshToken es obligatorio'
    );
  }

  let payload;

  try {
    payload = verify(refreshToken);
  } catch {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Refresh token inválido o expirado'
    );
  }

  if (
    payload.typ !== 'refresh' ||
    !validId(payload.sub) ||
    !validId(payload.sid)
  ) {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Token sin sesión válida'
    );
  }

  const sessionRef = db.collection(COL.adminSessions)
    .doc(payload.sid);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);

    // Repetir el logout no provoca errores ni crea sesiones.
    if (!snap.exists) return { success: true, changed: false };

    const session = snap.data();

    if ((session.adminId ?? session.userId) !== payload.sub) {
      return { forbidden: true };
    }

    if (session.revokedAt == null) {
      tx.update(sessionRef, {
        revokedAt: Timestamp.now(),
        revokedBy: payload.sub,
      });
      return { success: true, changed: true };
    }

    return { success: true, changed: false };
  });

  if (result.forbidden) {
    return fail(
      res, 403, 'AUTH_FORBIDDEN',
      'La sesión no pertenece al usuario'
    );
  }

  // Solo se audita el cierre efectivo (no los reintentos).
  if (result.changed) {
    const admin = await getDoc(COL.adminUsers, payload.sub);
    await logAudit(
      { user: { id: payload.sub, name: admin?.name, role: admin?.role } },
      'logout', `adminSessions/${payload.sid}`, null
    );
  }

  // Contrato de Max: 204 sin cuerpo.
  return res.status(204).end();
}));

// Cierra TODAS las sesiones activas del admin autenticado
// (por ejemplo si perdió un dispositivo o sospecha de un robo de token).
r.post('/auth/logout-all', authRequired, wrap(async (req, res) => {
  const snap = await db.collection(COL.adminSessions)
    .where('adminId', '==', req.user.id)
    .where('revokedAt', '==', null)
    .get();

  const now = Timestamp.now();

  for (let k = 0; k < snap.docs.length; k += 400) {
    const batch = db.batch();
    snap.docs.slice(k, k + 400).forEach((d) =>
      batch.update(d.ref, { revokedAt: now, revokedBy: req.user.id })
    );
    await batch.commit();
  }

  await logAudit(
    req, 'logout', `adminSessions/*`,
    { scope: 'all', revoked: snap.size }
  );

  return res.status(204).end();
}));

export default r;
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Timestamp } from 'firebase-admin/firestore';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { signAccess, signRefresh, verify } from '../lib/jwt.js';
import { COL, db, FieldValue, listAll, getDoc } from '../data/repo.js';

const r = Router();

// Bloqueo temporal por intentos fallidos (modelo de Max, adminUsers.lockedUntil):
// 10 fallos consecutivos => cuenta bloqueada 15 minutos.
const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

const toMillis = (v) => (!v ? 0 : typeof v.toMillis === 'function' ? v.toMillis() : new Date(v).getTime() || 0);

// Busca por `emailLower` con una consulta indexada (1 lectura) en vez de leer
// todos los adminUsers. Si la cuenta aún no tiene emailLower (base anterior
// al backfill-admin-fields), cae a una búsqueda completa para no dejar a
// nadie afuera durante la transición.
async function findAdminByEmail(email) {
  const lower = String(email).trim().toLowerCase();
  const snap = await db.collection(COL.adminUsers).where('emailLower', '==', lower).limit(1).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  const all = await listAll(COL.adminUsers);
  return all.find((u) => u.email?.toLowerCase() === lower) || null;
}

// Escritura directa con merge: el helper de repo haría 2 lecturas extra por llamada.
const touchAdmin = (id, patch) => db.collection(COL.adminUsers).doc(id).set(patch, { merge: true });

const pubOf = (user) => ({ id: user.id, name: user.name, role: user.role, email: user.email });

// POST /admin/auth/login  (público)
r.post('/auth/login', wrap(async (req, res) => {
  const { email, password, otp } = req.body || {};
  if (!email || !password) return fail(res, 400, 'VALIDATION', 'email y password son obligatorios');
  const user = await findAdminByEmail(email);
  if (!user) return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas');

  // Cuenta bloqueada temporalmente por demasiados intentos fallidos.
  if (toMillis(user.lockedUntil) > Date.now()) {
    return fail(res, 423, 'ACCOUNT_LOCKED', `Cuenta bloqueada temporalmente por intentos fallidos. Reintenta en ${LOCK_MINUTES} minutos.`);
  }

  const match = await bcrypt.compare(password, user.passwordHash || '');
  if (!match) {
    const failed = (user.failedLoginCount || 0) + 1;
    const patch = { failedLoginCount: failed, updatedAt: FieldValue.serverTimestamp() };
    if (failed >= MAX_FAILED) patch.lockedUntil = Timestamp.fromMillis(Date.now() + LOCK_MINUTES * 60 * 1000);
    await touchAdmin(user.id, patch);
    return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas');
  }

  // Cuenta deshabilitada (adminUsers.active = false). Se revisa DESPUÉS de la
  // contraseña para no revelar a un tercero qué correos existen.
  if (user.active === false) return fail(res, 403, 'ACCOUNT_DISABLED', 'Cuenta deshabilitada. Contacta a un administrador.');

  // MFA recomendado para admin/finance: si el usuario tiene mfaEnabled, exigir otp (demo: 123456)
  if (user.mfaEnabled && otp !== '123456') {
    return fail(res, 401, 'AUTH_MFA_REQUIRED', 'Se requiere código MFA válido (demo: 123456)');
  }

  await touchAdmin(user.id, {
    failedLoginCount: 0, lockedUntil: null,
    lastLoginAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const pub = pubOf(user);
  return ok(res, { user: pub, accessToken: signAccess(pub), refreshToken: signRefresh(pub) });
}));

// POST /admin/auth/refresh
r.post('/auth/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return fail(res, 400, 'VALIDATION', 'refreshToken es obligatorio');
  let payload;
  try { payload = verify(refreshToken); } catch { return fail(res, 401, 'AUTH_INVALID', 'Refresh token inválido'); }
  if (payload.typ !== 'refresh') return fail(res, 401, 'AUTH_INVALID', 'Tipo de token inválido');
  const user = await getDoc(COL.adminUsers, payload.sub);
  if (!user) return fail(res, 401, 'AUTH_INVALID', 'Usuario no encontrado');
  if (user.active === false) return fail(res, 403, 'ACCOUNT_DISABLED', 'Cuenta deshabilitada. Contacta a un administrador.');
  const pub = pubOf(user);
  return ok(res, { accessToken: signAccess(pub), refreshToken: signRefresh(pub) });
}));

export default r;

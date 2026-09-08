import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { ok } from '../lib/envelope.js';
import { fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { signAccess, signRefresh, verify } from '../lib/jwt.js';
import { COL, listAll } from '../data/repo.js';

const r = Router();

// POST /admin/auth/login  (público)
r.post('/auth/login', wrap(async (req, res) => {
  const { email, password, otp } = req.body || {};
  if (!email || !password) return fail(res, 400, 'VALIDATION', 'email y password son obligatorios');
  const users = await listAll(COL.adminUsers);
  const user = users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
  if (!user) return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas');
  const match = await bcrypt.compare(password, user.passwordHash || '');
  if (!match) return fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Credenciales inválidas');
  // MFA recomendado para admin/finance: si el usuario tiene mfaEnabled, exigir otp (demo: 123456)
  if (user.mfaEnabled && otp !== '123456') {
    return fail(res, 401, 'AUTH_MFA_REQUIRED', 'Se requiere código MFA válido (demo: 123456)');
  }
  const pub = { id: user.id, name: user.name, role: user.role, email: user.email };
  return ok(res, { user: pub, accessToken: signAccess(pub), refreshToken: signRefresh(pub) });
}));

// POST /admin/auth/refresh
r.post('/auth/refresh', wrap(async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return fail(res, 400, 'VALIDATION', 'refreshToken es obligatorio');
  let payload;
  try { payload = verify(refreshToken); } catch { return fail(res, 401, 'AUTH_INVALID', 'Refresh token inválido'); }
  if (payload.typ !== 'refresh') return fail(res, 401, 'AUTH_INVALID', 'Tipo de token inválido');
  const users = await listAll(COL.adminUsers);
  const user = users.find((u) => u.id === payload.sub);
  if (!user) return fail(res, 401, 'AUTH_INVALID', 'Usuario no encontrado');
  const pub = { id: user.id, name: user.name, role: user.role, email: user.email };
  return ok(res, { accessToken: signAccess(pub), refreshToken: signRefresh(pub) });
}));

export default r;

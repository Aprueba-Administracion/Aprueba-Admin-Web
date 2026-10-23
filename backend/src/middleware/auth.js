// Autenticación por JWT Bearer, sesión activa y permisos por rol.
import { verify } from '../lib/jwt.js';
import { fail } from '../lib/envelope.js';
import { COL, db } from '../data/repo.js';

const ADMIN_ROLES = ['admin', 'finance', 'ops', 'support'];

const validId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/') &&
  Buffer.byteLength(value, 'utf8') <= 1500;

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime() || 0;
};

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (!token) {
    return fail(
      res, 401, 'AUTH_REQUIRED',
      'Falta el token de acceso'
    );
  }

  let payload;

  try {
    payload = verify(token);
  } catch {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Token inválido o expirado'
    );
  }

  if (
    payload.typ !== 'access' ||
    !validId(payload.sub) ||
    !validId(payload.sid)
  ) {
    return fail(
      res, 401, 'AUTH_INVALID',
      'Token sin sesión válida. Inicia sesión nuevamente.'
    );
  }

  if (!ADMIN_ROLES.includes(payload.role)) {
    return fail(
      res, 403, 'AUTH_FORBIDDEN',
      'Rol no autorizado para la consola'
    );
  }

  try {
    const [sessionSnap, adminSnap] = await Promise.all([
      db.collection(COL.adminSessions).doc(payload.sid).get(),
      db.collection(COL.adminUsers).doc(payload.sub).get(),
    ]);

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

    if (!adminSnap.exists) {
      return fail(
        res, 401, 'AUTH_INVALID',
        'Usuario no encontrado'
      );
    }

    const admin = adminSnap.data();

    if (admin.active === false) {
      return fail(
        res, 403, 'ACCOUNT_DISABLED',
        'Cuenta deshabilitada. Contacta a un administrador.'
      );
    }

    // Usa el rol actual de Firestore para aplicar cambios de permisos.
    if (!ADMIN_ROLES.includes(admin.role)) {
      return fail(
        res, 403, 'AUTH_FORBIDDEN',
        'Rol no autorizado para la consola'
      );
    }

    req.user = {
      id: payload.sub,
      name: admin.name || '',
      role: admin.role,
    };

    req.sessionId = payload.sid;
  } catch (error) {
    // Los errores de Firestore los maneja el middleware de errores.
    return next(error);
  }

  return next();
}

// Exige uno de los roles indicados; admin siempre pasa.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(
        res, 401, 'AUTH_REQUIRED',
        'No autenticado'
      );
    }

    if (
      req.user.role === 'admin' ||
      roles.includes(req.user.role)
    ) {
      return next();
    }

    return fail(
      res, 403, 'AUTH_FORBIDDEN',
      `Se requiere rol: ${roles.join(' o ')}`
    );
  };
}
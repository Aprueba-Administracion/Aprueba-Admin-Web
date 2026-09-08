// Autenticación por JWT Bearer y control de acceso por rol.
// Roles administrativos: admin (todo), finance (recaudación), ops (infraestructura), support (usuarios/tickets).
import { verify } from '../lib/jwt.js';
import { fail } from '../lib/envelope.js';

export function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return fail(res, 401, 'AUTH_REQUIRED', 'Falta el token de acceso');
  try {
    const payload = verify(token);
    if (payload.typ !== 'access') return fail(res, 401, 'AUTH_INVALID', 'Tipo de token inválido');
    if (payload.role === 'student') return fail(res, 403, 'AUTH_FORBIDDEN', 'Rol no autorizado para la consola');
    req.user = { id: payload.sub, name: payload.name, role: payload.role };
    next();
  } catch (e) {
    return fail(res, 401, 'AUTH_INVALID', 'Token inválido o expirado');
  }
}

// Exige uno de los roles indicados; admin siempre pasa.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, 'AUTH_REQUIRED', 'No autenticado');
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return fail(res, 403, 'AUTH_FORBIDDEN', `Se requiere rol: ${roles.join(' o ')}`);
  };
}

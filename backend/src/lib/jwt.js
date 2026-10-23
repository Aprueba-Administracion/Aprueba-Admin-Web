import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

// Identificador único de cada refresh token (para rotación).
export const newJti = () => randomUUID();

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900);

export const REFRESH_TTL = Number(
  process.env.JWT_REFRESH_TTL || 604800
);

export function signAccess(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      role: user.role,
      sid: sessionId,
      typ: 'access',
    },
    SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

export function signRefresh(user, sessionId, jti) {
  return jwt.sign(
    {
      sub: user.id,
      sid: sessionId,
      typ: 'refresh',
    },
    SECRET,
    { expiresIn: REFRESH_TTL, ...(jti ? { jwtid: jti } : {}) }
  );
}

export function verify(token) {
  return jwt.verify(token, SECRET);
}
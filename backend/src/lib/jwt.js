import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL || 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL || 2592000);

export function signAccess(user) {
  return jwt.sign({ sub: user.id, name: user.name, role: user.role, typ: 'access' }, SECRET, { expiresIn: ACCESS_TTL });
}
export function signRefresh(user) {
  return jwt.sign({ sub: user.id, typ: 'refresh' }, SECRET, { expiresIn: REFRESH_TTL });
}
export function verify(token) {
  return jwt.verify(token, SECRET);
}

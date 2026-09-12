import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll } from '../data/repo.js';

const r = Router();

// GET /admin/audit-log — bitácora de acciones administrativas sensibles.
// Solo gerencia (admin) puede verla (D-BE-1001 / D-FE-1002).
r.get('/audit-log', requireRole('admin'), wrap(async (req, res) => {
  let rows = await listAll(COL.auditLog);
  rows.sort((a, b) => new Date(b.at) - new Date(a.at));

  const { action, resource } = req.query;
  if (action) rows = rows.filter((x) => x.action === action);
  if (resource) rows = rows.filter((x) => x.resource?.startsWith(resource));

  // Se limita a las 200 más recientes: es una bitácora de revisión, no un export masivo.
  return ok(res, rows.slice(0, 200), 200, { pagination: { total: rows.length } });
}));

export default r;

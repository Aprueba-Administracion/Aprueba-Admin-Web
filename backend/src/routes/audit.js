import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, listAll, listRecent } from '../data/repo.js';

const r = Router();

const AUDIT_LIMIT = 200;

// GET /admin/audit-log — bitácora de acciones administrativas sensibles.
// Solo gerencia (admin) puede verla (D-BE-1001 / D-FE-1002).
r.get('/audit-log', requireRole('admin'), wrap(async (req, res) => {
  const { action, resource } = req.query;

  // Camino más común (sin filtros, "ver la bitácora"): se le pide a Firestore
  // ya ordenado y acotado a las 200 más recientes, en vez de bajar TODA la
  // colección para ordenarla y cortarla en memoria en cada carga.
  if (!action && !resource) {
    const rows = await listRecent(COL.auditLog, 'at', AUDIT_LIMIT);
    return ok(res, rows, 200, { pagination: { total: rows.length } });
  }

  // Con filtros activos se mantiene tal cual el camino anterior: filtrar por
  // action/resource junto con el orden en Firestore pediría un índice
  // compuesto que este proyecto no tiene creado, así que se sigue filtrando
  // en memoria para no arriesgar que la bitácora deje de funcionar.
  let rows = await listAll(COL.auditLog);
  rows.sort((a, b) => new Date(b.at) - new Date(a.at));
  if (action) rows = rows.filter((x) => x.action === action);
  if (resource) rows = rows.filter((x) => x.resource?.startsWith(resource));

  return ok(res, rows.slice(0, AUDIT_LIMIT), 200, { pagination: { total: rows.length } });
}));

export default r;

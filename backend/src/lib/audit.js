// Bitácora de auditoría (épica D-E8). Registra quién hizo qué acción
// administrativa sensible, sobre qué recurso y cuándo.
import { COL, addDoc } from '../data/repo.js';

// Nunca debe romper la respuesta principal: si falla el guardado del log,
// solo se deja constancia en consola y la acción original sigue su curso.
export async function logAudit(req, action, resource, detail) {
  try {
    await addDoc(COL.auditLog, {
      actorId: req.user?.id || null,
      actorName: req.user?.name || null,
      actorRole: req.user?.role || null,
      action,
      resource,
      detail: detail ?? null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[audit] no se pudo registrar la acción:', e.message);
  }
}

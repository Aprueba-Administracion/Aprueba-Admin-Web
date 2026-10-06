// Bitácora de auditoría (épica D-E8). Registra quién hizo qué acción
// administrativa sensible, sobre qué recurso y cuándo.
import { COL, addDoc } from '../data/repo.js';

// Firestore rechaza `undefined` en cualquier nivel del documento (p. ej. los
// PATCH de tickets/recorrecciones mandan campos opcionales sin valor). Se
// descartan antes de guardar; así la acción SÍ queda en la bitácora.
function stripUndefined(v) {
  if (Array.isArray(v)) return v.map(stripUndefined);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, stripUndefined(x)]));
  }
  return v;
}

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
      detail: stripUndefined(detail) ?? null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[audit] no se pudo registrar la acción:', e.message);
  }
}

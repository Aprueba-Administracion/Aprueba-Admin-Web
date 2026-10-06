// Métricas EN VIVO de la vista Operativa.
//
// El modelo de Max separa los datos vivos (Cloud Monitoring / Cloud Run, que NO
// se guardan en Firestore) de la configuración (opsConfig) y el último snapshot
// (serviceStatus). Este proyecto aún no está conectado a Google Cloud, así que
// hasta entonces las métricas de los contenedores son SIMULADAS. Todo lo que
// dependa de esa fuente pasa por este módulo y se reconoce por `source: 'simulated'`.
// Cuando exista Cloud Run, solo hay que reemplazar liveMetrics() y requestRestart().

export const LIVE_SOURCE = 'simulated';

// Un reinicio simulado "termina" tras este tiempo. En producción lo cierra el job
// restart-watcher (finishedAt/result) y el bloqueo dura hasta 10 minutos.
export const RESTART_SETTLE_MS = 15 * 1000;

const BASE = {
  'api-gateway': { state: 'ok', cpu: 34, mem: 51 },
  'auth-svc': { state: 'ok', cpu: 22, mem: 40 },
  'content-svc': { state: 'deg', cpu: 78, mem: 69 },
  'badge-worker': { state: 'ok', cpu: 18, mem: 33 },
  'db-primary': { state: 'ok', cpu: 46, mem: 72 },
  'notif-worker': { state: 'down', cpu: 0, mem: 0 },
  'redis-cache': { state: 'ok', cpu: 12, mem: 28 },
  'cdn-edge': { state: 'ok', cpu: 8, mem: 14 },
};
const RECOVERED = { state: 'ok', cpu: 5, mem: 12 };

export const toMillis = (v) => (!v ? 0 : typeof v.toMillis === 'function' ? v.toMillis() : new Date(v).getTime() || 0);

export const restartInProgress = (restart, now = Date.now()) =>
  !!restart && !restart.finishedAt && now - toMillis(restart.requestedAt) < RESTART_SETTLE_MS;

// Estado vivo de un contenedor, considerando su último reinicio (si lo hay).
export function liveMetrics(item, restart, now = Date.now()) {
  const base = BASE[item.name] || { state: 'ok', cpu: 0, mem: 0 };
  if (restart && restartInProgress(restart, now)) return { state: 'deg', cpu: base.cpu, mem: base.mem, restarting: true };
  if (restart && restart.result === 'ready') return { ...RECOVERED, restarting: false };
  return { ...base, restarting: false };
}

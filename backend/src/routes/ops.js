import crypto from 'crypto';
import { Router } from 'express';
import { ok, fail } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, db, listAll, getDoc } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';
import { LIVE_SOURCE, RESTART_SETTLE_MS, toMillis, restartInProgress, liveMetrics } from '../lib/liveOps.js';

const r = Router();

// ── Modelo canónico de Max (sección 8: Operativa) ───────────────────────────
//  platforms/{ios|android|web}  · serviceStatus/{login|badges|…}
//  opsConfig/{services|containers|sync}  · opsRestarts/{serviceName}
// Los datos vivos (CPU, memoria, estado de contenedores) no se guardan en
// Firestore: salen de lib/liveOps.js (hoy simulados, ver ese archivo).

const iso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v ?? null);
const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99);
const STORES_STALE_MS = 36 * 60 * 60 * 1000; // sync-stores > 36 h => meta.stale

const PLATFORM_ORDER = ['ios', 'android', 'web'];

// GET /admin/platforms (ops/admin)
r.get('/platforms', requireRole('ops'), wrap(async (_req, res) => {
  const [rows, sync] = await Promise.all([listAll(COL.platforms), getDoc(COL.opsConfig, 'sync')]);
  rows.sort((a, b) => PLATFORM_ORDER.indexOf(a.id) - PLATFORM_ORDER.indexOf(b.id));
  const data = rows.map((p) => ({
    id: p.id,
    name: p.name ?? p.platform ?? p.id,
    platform: p.name ?? p.platform ?? p.id, // alias que usa la consola actual
    version: p.version,
    available: !!p.available,
    downloads: p.downloads ?? null,
    downloadsDelta: p.downloadsDelta ?? 0,
    storeUrl: p.storeUrl ?? null,
    updatedAt: iso(p.updatedAt),
    syncedAt: iso(p.syncedAt),
    syncSource: p.syncSource ?? null,
  }));
  const syncedAt = iso(sync?.storesSyncedAt);
  const stale = !syncedAt || Date.now() - toMillis(syncedAt) > STORES_STALE_MS;
  return ok(res, data, 200, { sync: { storesSyncedAt: syncedAt, stale } });
}));

// GET /admin/services (ops/admin) — configuración (opsConfig/services) + último
// snapshot de salud (serviceStatus). Sin Cloud Monitoring conectado el snapshot
// siempre es el persistido, por eso se informa meta.cache = "stale".
r.get('/services', requireRole('ops'), wrap(async (_req, res) => {
  const [cfg, snaps, restarts] = await Promise.all([getDoc(COL.opsConfig, 'services'), listAll(COL.serviceStatus), listAll(COL.opsRestarts)]);
  await settleRestarts(restarts);
  await syncServicesAfterRestart(cfg, snaps, restarts);
  const snapByKey = new Map(snaps.map((s) => [s.id, s]));
  const items = (cfg?.items?.length ? [...cfg.items].sort(byOrder) : snaps.map((s) => ({ key: s.id, name: s.name })));
  const data = items.map((it) => {
    const s = snapByKey.get(it.key) || {};
    return {
      id: it.key, key: it.key,
      name: it.name || s.name,
      state: s.state || 'deg',
      uptimePct: s.uptimePct ?? null,
      latencyMs: s.latencyMs ?? null,
      consecutiveFailures: s.consecutiveFailures ?? 0,
      checkedAt: iso(s.checkedAt),
      source: s.source || null,
    };
  });
  return ok(res, data, 200, { cache: 'stale', source: 'serviceStatus' });
}));

// Un reinicio exitoso de un contenedor deja sano al servicio de negocio que corre
// sobre él (opsConfig/services.items[].cloudRunService). Con Cloud Monitoring real,
// el uptime check lo hará solo; mientras los contenedores sean simulados, el
// snapshot de serviceStatus los sigue para que "Estado de servicios" y
// "Contenedores" no se contradigan. Solo aplica si el reinicio terminó DESPUÉS
// del último chequeo guardado (así es idempotente y no pisa chequeos nuevos).
async function syncServicesAfterRestart(cfg, snaps, restarts) {
  const byId = new Map(snaps.map((x) => [x.id, x]));
  const ready = new Map(restarts.filter((x) => x.result === 'ready' && x.finishedAt).map((x) => [x.id, x]));
  await Promise.all((cfg?.items || []).map(async (it) => {
    const rs = ready.get(it.cloudRunService);
    const snap = byId.get(it.key);
    if (!rs || !snap || snap.state === 'ok') return;
    if (toMillis(rs.finishedAt) <= toMillis(snap.checkedAt)) return;
    const patch = {
      state: 'ok', consecutiveFailures: 0,
      latencyMs: snap.latencyMs ?? 140,
      checkedAt: rs.finishedAt, source: LIVE_SOURCE,
    };
    await db.collection(COL.serviceStatus).doc(it.key).set(patch, { merge: true });
    Object.assign(snap, patch);
  }));
}

// Cierra de forma perezosa los reinicios simulados que ya cumplieron su tiempo
// (hace el papel del job restart-watcher mientras no exista Cloud Run).
async function settleRestarts(restarts, now = Date.now()) {
  await Promise.all(restarts
    .filter((x) => !x.finishedAt && now - toMillis(x.requestedAt) >= RESTART_SETTLE_MS)
    .map(async (x) => {
      const patch = { finishedAt: new Date(), result: 'ready', newRevision: `${x.id}-${crypto.randomBytes(3).toString('hex')}` };
      await db.collection(COL.opsRestarts).doc(x.id).set(patch, { merge: true });
      Object.assign(x, patch);
    }));
}

// GET /admin/containers (ops/admin) — config (opsConfig/containers) + métricas vivas
r.get('/containers', requireRole('ops'), wrap(async (_req, res) => {
  const [cfg, restarts, svcCfg, snaps] = await Promise.all([getDoc(COL.opsConfig, 'containers'), listAll(COL.opsRestarts), getDoc(COL.opsConfig, 'services'), listAll(COL.serviceStatus)]);
  await settleRestarts(restarts);
  await syncServicesAfterRestart(svcCfg, snaps, restarts);
  const byName = new Map(restarts.map((x) => [x.id, x]));
  const items = [...(cfg?.items || [])].sort(byOrder);
  const data = items.map((it) => ({
    id: it.name, name: it.name, kind: it.kind, region: it.region,
    restartable: !!it.restartable, order: it.order,
    ...liveMetrics(it, byName.get(it.name)),
  }));
  return ok(res, data, 200, { source: LIVE_SOURCE });
}));

// POST /admin/containers/:name/restart (ops/admin)
// Un documento por servicio en opsRestarts hace de bloqueo: mientras haya un
// reinicio en curso, otro responde 409 RESTART_IN_PROGRESS. El reinicio real
// (Cloud Run) aún no existe: se registra la solicitud y se simula su cierre.
r.post('/containers/:name/restart', requireRole('ops'), wrap(async (req, res) => {
  const name = req.params.name;
  const cfg = await getDoc(COL.opsConfig, 'containers');
  const item = cfg?.items?.find((i) => i.name === name);
  if (!item) return fail(res, 404, 'NOT_FOUND', 'Contenedor no encontrado');
  if (!item.restartable) return fail(res, 422, 'NOT_RESTARTABLE', `${name} no se puede reiniciar desde la consola`);

  const ref = db.collection(COL.opsRestarts).doc(name);
  const now = new Date();
  const operationId = `simulated/operations/${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) || null : null;

  const locked = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && restartInProgress(snap.data(), now.getTime())) return true;
    tx.set(ref, {
      operationId, requestedBy: req.user.id, requestedByName: req.user.name, reason,
      requestedAt: now, finishedAt: null, result: null, newRevision: null,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // TTL 30 días
    });
    return false;
  });
  if (locked) return fail(res, 409, 'RESTART_IN_PROGRESS', `Ya hay un reinicio en curso para ${name}`);

  await logAudit(req, 'restart', `containers/${name}`, { operationId, reason });
  return ok(res, { name, action: 'restart', status: 'scheduled', operationId }, 202);
}));

export default r;

// Migración del punto #5 de MODELO_CAMBIOS.md (Operativa al modelo canónico de Max).
// NO borra nada: crea lo nuevo a partir de lo legado y deja las colecciones
// `services` y `containers` intactas (se pueden eliminar a mano más adelante).
//
//  services (legado)    -> serviceStatus/{key}: name {es,en}, uptimePct (número), latencyMs (número),
//                          consecutiveFailures, checkedAt, source
//                          + opsConfig/services (qué se mide, con su orden)
//  containers (legado)  -> opsConfig/containers: items[{name, kind, region, restartable, metric, order}]
//                          (cpu/mem/estado en vivo ya NO se guardan: salen de lib/liveOps.js)
//  (nuevo)              -> opsConfig/sync {storesSyncedAt, metricsAggregatedThrough}
//  platforms            -> name (antes `platform`), downloadsDelta, syncedAt, syncSource,
//                          updatedAt como timestamp, downloads null en la PWA
//
// Idempotente: no pisa documentos que ya estén migrados.
//
// Uso (desde backend/). Sin emulador el candado exige --real a propósito:
//   node src/scripts/migrate-ops.js --dry-run --real   (solo muestra qué haría)
//   node src/scripts/migrate-ops.js --real             (migra de verdad)
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';

const DRY_RUN = process.argv.includes('--dry-run');
const REGION = 'southamerica-west1';

const SVC = {
  login: { en: 'Login', check: 'login-https-check', run: 'auth-svc' },
  badges: { en: 'Badge assignment', check: 'badges-health', run: 'badge-worker' },
  questions: { en: 'Question delivery', check: 'content-health', run: 'content-svc' },
  payments: { en: 'Payments', check: 'payments-health', run: 'payments-svc' },
  notif: { en: 'Notifications', check: 'notif-health', run: 'notif-worker' },
};
const SVC_ORDER = ['login', 'badges', 'questions', 'payments', 'notif'];
const CONTAINER_SPEC = {
  'api-gateway': { kind: 'cloud_run', restartable: true, metric: null },
  'auth-svc': { kind: 'cloud_run', restartable: true, metric: null },
  'content-svc': { kind: 'cloud_run', restartable: true, metric: null },
  'badge-worker': { kind: 'cloud_run', restartable: true, metric: null },
  'db-primary': { kind: 'firestore', restartable: false, metric: { cpu: null, mem: 'firestore.googleapis.com/document/read_count' } },
  'notif-worker': { kind: 'cloud_run', restartable: true, metric: null },
  'redis-cache': { kind: 'memorystore', restartable: false, metric: { cpu: 'redis.googleapis.com/stats/cpu_utilization', mem: 'redis.googleapis.com/stats/memory/usage_ratio' } },
  'cdn-edge': { kind: 'cdn', restartable: false, metric: { cpu: null, mem: null } },
};
const CONTAINER_ORDER = Object.keys(CONTAINER_SPEC);

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const write = async (ref, data, opts) => { if (!DRY_RUN) await ref.set(data, opts); };

async function migrateServices() {
  const snap = await db.collection(COL.services).get();
  console.log(`\n--- services (legado): ${snap.size} documentos ---`);
  const cfgItems = [];
  for (const d of snap.docs) {
    const x = d.data(); const key = x.key || d.id;
    const meta = SVC[key] || { en: x.name, check: null, run: null };
    const target = db.collection(COL.serviceStatus).doc(key);
    if ((await target.get()).exists) { console.log(`[${key}] serviceStatus ya existe, se omite.`); }
    else {
      const doc = {
        name: typeof x.name === 'object' ? x.name : { es: x.name, en: meta.en },
        state: x.state || 'deg', uptimePct: num(x.uptimePct ?? x.uptime), latencyMs: num(x.latencyMs ?? x.latency),
        consecutiveFailures: 0, checkedAt: new Date(), source: 'cloud_monitoring',
      };
      console.log(`[${key}] -> serviceStatus`, JSON.stringify({ ...doc, checkedAt: '(ahora)' }));
      await write(target, doc);
    }
    cfgItems.push({ key, name: typeof x.name === 'object' ? x.name : { es: x.name, en: meta.en }, uptimeCheckId: meta.check, cloudRunService: meta.run, region: REGION, order: SVC_ORDER.indexOf(key) + 1 || 99 });
  }
  const cfgRef = db.collection(COL.opsConfig).doc('services');
  if ((await cfgRef.get()).exists) console.log('[opsConfig/services] ya existe, se omite.');
  else { console.log(`[opsConfig/services] -> ${cfgItems.length} items`); await write(cfgRef, { items: cfgItems.sort((a, b) => a.order - b.order), updatedAt: FieldValue.serverTimestamp(), updatedBy: 'migration' }); }
}

async function migrateContainers() {
  const snap = await db.collection(COL.containers).get();
  console.log(`\n--- containers (legado): ${snap.size} documentos ---`);
  const ref = db.collection(COL.opsConfig).doc('containers');
  if ((await ref.get()).exists) { console.log('[opsConfig/containers] ya existe, se omite.'); return; }
  const items = snap.docs.map((d) => {
    const name = d.data().name || d.id; const spec = CONTAINER_SPEC[name] || { kind: 'cloud_run', restartable: false, metric: null };
    return { name, kind: spec.kind, region: spec.kind === 'cdn' ? 'global' : REGION, restartable: spec.restartable, metric: spec.metric, order: CONTAINER_ORDER.indexOf(name) + 1 || 99 };
  }).sort((a, b) => a.order - b.order);
  console.log(`[opsConfig/containers] -> ${items.length} items`);
  await write(ref, { items, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'migration' });
}

async function migrateSync() {
  const ref = db.collection(COL.opsConfig).doc('sync');
  if ((await ref.get()).exists) { console.log('\n[opsConfig/sync] ya existe, se omite.'); return; }
  console.log('\n[opsConfig/sync] -> storesSyncedAt null, metricsAggregatedThrough null');
  await write(ref, { storesSyncedAt: null, metricsAggregatedThrough: null, updatedAt: FieldValue.serverTimestamp() });
}

async function migratePlatforms() {
  const snap = await db.collection(COL.platforms).get();
  console.log(`\n--- platforms: ${snap.size} documentos ---`);
  for (const d of snap.docs) {
    const x = d.data(); const p = {};
    if (x.name === undefined) p.name = x.platform || d.id;
    if (x.platform !== undefined) p.platform = FieldValue.delete();
    if (x.downloadsDelta === undefined) p.downloadsDelta = 0;
    if (x.storeUrl === undefined) p.storeUrl = null;
    if (typeof x.updatedAt === 'string') p.updatedAt = new Date(x.updatedAt);
    if (x.downloads === 0 && d.id === 'web') p.downloads = null;
    if (x.syncSource === undefined) p.syncSource = { ios: 'app_store_connect', android: 'google_play', web: 'pwa_manifest' }[d.id] || null;
    if (x.syncedAt === undefined) p.syncedAt = null;
    if (!Object.keys(p).length) { console.log(`[${d.id}] ya migrado, se omite.`); continue; }
    console.log(`[${d.id}] -> ${Object.keys(p).join(', ')}`);
    await write(d.ref, p, { merge: true });
  }
}

async function main() {
  assertSafeTarget('migrate:ops');
  console.log(DRY_RUN ? '=== MIGRACIÓN Operativa (--dry-run: no se escribe nada) ===' : '=== MIGRACIÓN Operativa (SE VA A ESCRIBIR) ===');
  await migrateServices();
  await migrateContainers();
  await migrateSync();
  await migratePlatforms();
  console.log(DRY_RUN ? '\nNada se escribió. Si se ve bien, corre sin --dry-run.' : '\nListo. Las colecciones legadas services y containers siguen intactas.');
  process.exit(0);
}
main().catch((e) => { console.error('\nError en la migración:', e); process.exit(1); });

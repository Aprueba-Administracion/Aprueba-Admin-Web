// Punto #2 de MODELO_CAMBIOS.md: crea metricsDaily (90 días) y metricsMonthly.
// Aún no existe el job aggregate-metrics ni un pipeline real de eventos, así que
// los documentos se generan de forma determinística y quedan marcados
// `synthetic: true` (la API los expone como meta.source = "synthetic").
// Idempotente (set por ID) y NO toca metrics/{overview,commercial} (el respaldo legado).
//
// Uso (desde backend/). Sin emulador el candado exige --real a propósito:
//   node src/scripts/generate-metrics.js --dry-run --real   (solo muestra qué haría)
//   node src/scripts/generate-metrics.js --real             (escribe ~115 documentos)
import 'dotenv/config';
import { db, COL } from '../data/repo.js';
import { assertSafeTarget } from '../lib/envGuard.js';
import { buildDailySeries, buildMonthly, todayInSantiago, writeSyntheticMetrics } from '../lib/syntheticMetrics.js';

assertSafeTarget('generate-metrics');
const DRY_RUN = process.argv.includes('--dry-run');

const sponsors = await db.collection(COL.sponsors).get();
const sponsorIds = sponsors.docs.filter((d) => !d.data().deletedAt).map((d) => d.id);
console.log(`Sponsors activos para el desglose de canjes: ${sponsorIds.length}`);

if (DRY_RUN) {
  const today = todayInSantiago();
  const series = buildDailySeries({ sponsorIds, today });
  const monthly = buildMonthly(series, today);
  const last = series[series.length - 1];
  console.log(`[dry-run] escribiría ${Math.min(90, series.length)} docs en metricsDaily y ${monthly.length} en metricsMonthly`);
  console.log(`[dry-run] último día ${last.date}: descargas acumuladas ${last.downloadsTotalToDate}, MAU ${last.mau}, MRR ${last.mrr}`);
  process.exit(0);
}
const r = await writeSyntheticMetrics(db, { sponsorIds });
console.log(`✓ metricsDaily: ${r.daily} docs · metricsMonthly: ${r.monthly} docs (synthetic: true)`);
process.exit(0);

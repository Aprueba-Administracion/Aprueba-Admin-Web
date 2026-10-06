import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, getDoc, listAll, db } from '../data/repo.js';
import { todayInSantiago, addDays, addMonths } from '../lib/syntheticMetrics.js';
import { logAudit } from '../lib/audit.js';

const r = Router();

// Factor de escala por rango respecto de la base sembrada (equivalente a 30 días).
// El proyecto no tiene aún un pipeline real de eventos por usuario/pago (ver
// sección 5 del plan, "Dependencias de datos"), así que mientras eso no exista,
// el rango escala de forma determinística todos los acumulados/conteos (descargas,
// usuarios activos, recaudación, embudo, badges). Los porcentajes/tasas (deltaPct,
// % de conversión) NO se escalan: son una razón entre dos acumulados que ya
// escalan por el mismo factor, así que su valor no debería cambiar con el rango.
// LEGADO (respaldo): solo se usa si metricsDaily/metricsMonthly aún no existen
// (p. ej. Firestore real antes de correr `npm run generate:metrics`).
const RANGE_FACTORS = { '7d': 0.23, '30d': 1, '90d': 2.9, '12m': 11 };
const VALID_RANGES = Object.keys(RANGE_FACTORS);
const rangeFromQuery = (q) => (VALID_RANGES.includes(q) ? q : '30d');
const scaleN = (n, factor) => Math.round((n || 0) * factor);

function scaleOverview(doc, factor) {
  return {
    ...doc,
    downloads: doc.downloads ? {
      ...doc.downloads,
      total: scaleN(doc.downloads.total, factor),
      month: scaleN(doc.downloads.month, factor),
      // deltaPct es un porcentaje: no se escala.
    } : doc.downloads,
    mau: doc.mau ? { ...doc.mau, value: scaleN(doc.mau.value, factor) } : doc.mau,
    converted: doc.converted ? { ...doc.converted, value: scaleN(doc.converted.value, factor) } : doc.converted,
    mrr: doc.mrr ? { ...doc.mrr, value: scaleN(doc.mrr.value, factor) } : doc.mrr,
    badgesIssued: scaleN(doc.badgesIssued, factor),
    // sponsorsActive es una foto del presente (cuántos sponsors hay activos ahora),
    // no un acumulado del período: no se escala.
    downloadsByMonth: (doc.downloadsByMonth || []).map((m) => ({ ...m, value: scaleN(m.value, factor) })),
  };
}


// ───────── Modelo de Max (#2): se componen desde metricsDaily / metricsMonthly ─────────
// 7d y 30d → ventana de días de metricsDaily; 90d y 12m → ventana de meses
// CERRADOS de metricsMonthly. Cada KPI se suma o se toma el último valor según su naturaleza
// (flujos: descargas/registros/conversiones/badges/canjes se suman; saldos: MAU,
// MRR y los …ToDate toman el último valor). El período anterior de igual largo
// alimenta los deltaPct. Lectura por clave (getAll), ≤ 60 documentos.
const RANGE_SPEC = { '7d': { unit: 'day', n: 7 }, '30d': { unit: 'day', n: 30 }, '90d': { unit: 'month', n: 3 }, '12m': { unit: 'month', n: 12 } };
const MONTH_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
const CACHE_MS = 60 * 1000; // caché de 60 s del documento compuesto (el modelo lo recomienda)
const cache = new Map();

const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);
async function getMany(col, ids) {
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => db.collection(col).doc(id)));
  return snaps.filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() }));
}
const keyOf = (row) => row.date || row.month;

async function loadWindow(range) {
  const { unit, n } = RANGE_SPEC[range];
  const today = todayInSantiago();
  let curIds; let prevIds; let col;
  if (unit === 'day') {
    col = COL.metricsDaily;
    const last = addDays(today, -1);
    curIds = Array.from({ length: n }, (_, i) => addDays(last, -(n - 1 - i)));
    prevIds = Array.from({ length: n }, (_, i) => addDays(last, -(2 * n - 1 - i)));
  } else {
    col = COL.metricsMonthly;
    // Solo meses CERRADOS (el mes en curso es parcial y falsearía los deltaPct).
    const ym = addMonths(today.slice(0, 7), -1);
    curIds = Array.from({ length: n }, (_, i) => addMonths(ym, -(n - 1 - i)));
    prevIds = Array.from({ length: n }, (_, i) => addMonths(ym, -(2 * n - 1 - i)));
  }
  const [cur, prev] = await Promise.all([getMany(col, curIds), getMany(col, prevIds)]);
  const byKey = (a, b) => (keyOf(a) < keyOf(b) ? -1 : 1);
  return { unit, cur: cur.sort(byKey), prev: prev.sort(byKey) };
}

const sumBy = (rows, f) => rows.reduce((s, x) => s + (f(x) || 0), 0);
const dauOf = (row) => (row ? (row.dauAvg ?? row.dau ?? 0) : 0);

function summarize(rows) {
  const last = rows[rows.length - 1];
  return {
    last,
    downloads: sumBy(rows, (x) => x.downloads?.total),
    registrations: sumBy(rows, (x) => x.registrations),
    conversions: sumBy(rows, (x) => x.conversions),
    benefits: sumBy(rows, (x) => x.benefitsRedeemed),
    badges: Object.fromEntries(['total', ...TIERS].map((t) => [t, sumBy(rows, (x) => x.badgesIssued?.[t])])),
  };
}

async function liveSponsorsActive(fallback) {
  try {
    const snap = await db.collection(COL.sponsors).where('deletedAt', '==', null).where('status', 'in', ['ok', 'deg']).count().get();
    const c = snap.data().count;
    return c > 0 ? c : fallback;
  } catch { return fallback; }
}

async function systemHealth() {
  const rows = await listAll(COL.serviceStatus);
  const down = rows.filter((s) => s.state === 'down').length;
  const deg = rows.filter((s) => s.state === 'deg').length;
  return { status: down + deg > 0 ? 'degraded' : 'ok', servicesDown: down };
}

async function downloadsByMonth() {
  const ym = todayInSantiago().slice(0, 7);
  const ids = Array.from({ length: 6 }, (_, i) => addMonths(ym, -(6 - i))); // últimos 6 meses cerrados
  const rows = (await getMany(COL.metricsMonthly, ids)).sort((a, b) => (a.month < b.month ? -1 : 1));
  return rows.map((m) => ({ month: MONTH_ES[Number(m.month.slice(5, 7)) - 1], value: m.downloads?.total || 0 }));
}

async function composeOverview(range) {
  const w = await loadWindow(range);
  if (!w.cur.length) return null; // sin datos canónicos → respaldo legado
  const c = summarize(w.cur); const p = summarize(w.prev);
  const l = c.last;
  const pl = p.last;
  const [sponsorsActive, health, byMonth] = await Promise.all([liveSponsorsActive(l.sponsorsActive), systemHealth(), downloadsByMonth()]);
  return {
    data: {
      downloads: { total: l.downloadsTotalToDate, month: c.downloads, deltaPct: pct(c.downloads, p.downloads) },
      mau: { value: l.mau, deltaPct: pct(l.mau, pl?.mau) },
      converted: { value: l.convertedToDate, rate: Math.round((l.convertedToDate / (l.mau || 1)) * 1000) / 10 },
      mrr: { value: l.mrr, deltaPct: pct(l.mrr, pl?.mrr) },
      badgesIssued: c.badges.total,
      sponsorsActive,
      downloadsByMonth: byMonth,
      revenueByPlan: Object.entries(l.revenueByPlan || {}).map(([plan, value]) => ({ plan, value })),
      systemHealth: health,
    },
    source: w.cur.some((x) => x.synthetic) ? 'synthetic' : 'aggregated',
  };
}

async function composeCommercial(range) {
  const w = await loadWindow(range);
  if (!w.cur.length) return null;
  const c = summarize(w.cur);
  const l = c.last;
  return {
    data: {
      downloads: c.downloads,
      dau: dauOf(l), mau: l.mau,
      converted: l.convertedToDate,
      convRate: Math.round((l.convertedToDate / (l.mau || 1)) * 1000) / 10,
      mrr: l.mrr,
      benefitsRedeemed: c.benefits,
      funnel: [
        { label: 'Descargas', value: l.downloadsTotalToDate },
        { label: 'Registrados', value: l.registeredToDate },
        { label: 'Activos (MAU)', value: l.mau },
        { label: 'Convertidos', value: l.convertedToDate },
      ],
      revenueByPlan: Object.entries(l.revenueByPlan || {}).map(([plan, value]) => ({ plan, value })),
      badgesByType: TIERS.map((tier) => ({ tier, value: c.badges[tier] })),
    },
    source: w.cur.some((x) => x.synthetic) ? 'synthetic' : 'aggregated',
  };
}

async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// GET /admin/metrics/overview  (cualquier rol administrativo)
// "Resumen" es la portada de la consola para los cuatro roles, así que el
// resumen ejecutivo tiene que ser legible por todos ellos (admin pasa siempre).
// ?range= 7d | 30d | 90d | 12m — recalcula los acumulados del período seleccionado.
r.get('/metrics/overview', requireRole('finance', 'ops', 'support'), wrap(async (req, res) => {
  const range = rangeFromQuery(req.query.range);
  const composed = await cached(`overview:${range}`, () => composeOverview(range));
  if (composed) return ok(res, composed.data, 200, { range, source: composed.source });
  // Respaldo: metricsDaily/metricsMonthly aún no existen en esta base.
  const doc = await getDoc(COL.metrics, 'overview');
  const scaled = doc ? scaleOverview(doc, RANGE_FACTORS[range]) : {};
  return ok(res, scaled, 200, { range, source: 'legacy' });
}));

function scaleCommercial(doc, factor) {
  return {
    ...doc,
    downloads: scaleN(doc.downloads, factor),
    converted: scaleN(doc.converted, factor),
    benefitsRedeemed: scaleN(doc.benefitsRedeemed, factor),
    dau: scaleN(doc.dau, factor),
    mau: scaleN(doc.mau, factor),
    mrr: scaleN(doc.mrr, factor),
    // % de conversión: si descargas y convertidos escalan por el mismo factor,
    // la razón entre ambos no cambia, así que se mantiene igual (no es un bug).
    convRate: doc.convRate,
    funnel: (doc.funnel || []).map((f) => ({ ...f, value: scaleN(f.value, factor) })),
    revenueByPlan: (doc.revenueByPlan || []).map((p) => ({ ...p, value: scaleN(p.value, factor) })),
    badgesByType: (doc.badgesByType || []).map((b) => ({ ...b, value: scaleN(b.value, factor) })),
  };
}

// GET /admin/metrics/commercial  (Bearer finance/admin)
// ?range= 7d | 30d | 90d | 12m — recalcula los acumulados del período seleccionado.
r.get('/metrics/commercial', requireRole('finance'), wrap(async (req, res) => {
  const range = rangeFromQuery(req.query.range);
  const composed = await cached(`commercial:${range}`, () => composeCommercial(range));
  let data; let source;
  if (composed) ({ data, source } = composed);
  else {
    const doc = await getDoc(COL.metrics, 'commercial');
    data = doc ? scaleCommercial(doc, RANGE_FACTORS[range]) : {};
    source = 'legacy';
  }
  // La recaudación es información sensible: queda registrado quién la consultó (D-BE-402).
  await logAudit(req, 'view', 'metrics/commercial', { range });
  return ok(res, data, 200, { range, source });
}));

export default r;

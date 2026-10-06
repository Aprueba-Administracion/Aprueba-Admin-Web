// Serie SINTÉTICA de metricsDaily / metricsMonthly (punto #2 del modelo de Max).
//
// Todavía no existe el job aggregate-metrics ni un pipeline real de eventos, así
// que los agregados se generan de forma determinística y se marcan con
// `synthetic: true` (la API lo expone como meta.source = "synthetic"). Cuando el
// job real escriba estas colecciones, basta dejar de usar este módulo.
//
// La serie diaria se construye hacia atrás desde los totales que ya mostraba la
// consola (128.540 descargas, 61.200 registrados, 3.180 convertidos, MAU 24.800,
// DAU 6.420, MRR 14.250), para que el día más reciente cierre exactamente en esos
// valores y los acumulados (…ToDate) sean coherentes con las sumas del período.

export const TZ = 'America/Santiago';
const DAYS = 760; // ≈ 25 meses: alcanza para 24 meses completos de metricsMonthly
const KEEP_DAILY = 90; // metricsDaily guarda 90 días (ventanas 7d/30d + período previo)

const END = { downloads: 128540, registered: 61200, converted: 3180, mau: 24800, dau: 6420, mrr: 14250 };
const REV_UNI = 4650 / 14250; // proporción del plan "uni" en el MRR final
const TIER_SHARE = { bronze: 0.785, silver: 0.153, gold: 0.047, diamond: 0.012 }; // platinum = resto
const r2 = (n) => Math.round(n * 100) / 100;

// YYYY-MM-DD de "hoy" en zona America/Santiago.
export function todayInSantiago(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // en-CA => 2026-10-06
}
export const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

// PRNG determinístico (mulberry32): mismos datos en cada seed.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reparte `total` en las claves de `weights` (suma exacta).
function split(total, weights) {
  const keys = Object.keys(weights);
  const sumW = keys.reduce((s, k) => s + weights[k], 0);
  const out = {};
  let acc = 0;
  keys.forEach((k, i) => {
    out[k] = i === keys.length - 1 ? total - acc : Math.round((total * weights[k]) / sumW);
    acc += out[k];
  });
  return out;
}

// sponsorIds: ids de los sponsors activos (para benefitsRedeemedBySponsor).
export function buildDailySeries({ sponsorIds = [], today = todayInSantiago(), days = DAYS } = {}) {
  const rand = rng(20260917);
  const last = addDays(today, -1); // el job cierra el día anterior
  const raw = [];
  for (let i = 0; i < days; i += 1) {
    const g = 0.3 + 0.7 * (i / (days - 1)); // crecimiento 0.3 → 1
    const wob = i === days - 1 ? 1 : 1 + (rand() - 0.5) * 0.18;
    const week = [1.0, 1.05, 1.08, 1.04, 0.95, 0.78, 0.74][i % 7]; // menos actividad el fin de semana
    raw.push({ g, wob, week });
  }
  const sumOf = (f) => raw.reduce((s, x) => s + f(x), 0);
  // Escalas para que las sumas de 760 días queden en ~88-92 % del acumulado final.
  const kDl = (END.downloads * 0.9) / sumOf((x) => x.g * x.wob * x.week);
  const dl = raw.map((x) => Math.max(0, Math.round(kDl * x.g * x.wob * x.week)));
  const reg = dl.map((d) => Math.round(d * (0.46 + rand() * 0.04)));
  const kReg = (END.registered * 0.9) / reg.reduce((s, v) => s + v, 0);
  const regs = reg.map((v) => Math.round(v * kReg));
  const conv0 = regs.map((v) => Math.round(v * (0.05 + rand() * 0.03)));
  const kConv = (END.converted * 0.9) / conv0.reduce((s, v) => s + v, 0);
  const conv = conv0.map((v) => Math.round(v * kConv));

  // Acumulados: hacia atrás desde el valor final conocido.
  const dlTo = new Array(days); const regTo = new Array(days); const convTo = new Array(days);
  dlTo[days - 1] = END.downloads; regTo[days - 1] = END.registered; convTo[days - 1] = END.converted;
  for (let i = days - 2; i >= 0; i -= 1) {
    dlTo[i] = dlTo[i + 1] - dl[i + 1];
    regTo[i] = regTo[i + 1] - regs[i + 1];
    convTo[i] = convTo[i + 1] - conv[i + 1];
  }

  const weights = Object.fromEntries((sponsorIds.length ? sponsorIds : []).map((id, k) => [id, 5 - (k % 5)]));
  return raw.map((x, i) => {
    const date = addDays(last, -(days - 1 - i));
    const ios = Math.round(dl[i] * 0.45);
    const mauV = Math.round(END.mau * x.g * (i === days - 1 ? 1 : x.wob ** 0.3));
    const dauV = Math.round(END.dau * x.g * (i === days - 1 ? 1 : x.wob * (x.week > 1 ? 1.03 : 0.97)));
    const mrr = r2(END.mrr * x.g * (i === days - 1 ? 1 : 0.99 + (x.wob - 1) * 0.1));
    const uni = r2(mrr * REV_UNI);
    const badges = Math.round(1100 * x.g * x.wob * x.week);
    const tiers = {};
    let used = 0;
    for (const [k, share] of Object.entries(TIER_SHARE)) { tiers[k] = Math.round(badges * share); used += tiers[k]; }
    tiers.platinum = Math.max(0, badges - used);
    const redeemed = Math.round(64 * (x.g / 1) * x.wob * x.week);
    return {
      date,
      downloads: { total: dl[i], ios, android: dl[i] - ios, web: 0 },
      downloadsTotalToDate: dlTo[i],
      dau: dauV, mau: mauV,
      registrations: regs[i], registeredToDate: regTo[i],
      conversions: conv[i], convertedToDate: convTo[i],
      mrr, revenueByPlan: { uni, all: r2(mrr - uni) },
      badgesIssued: { total: badges, ...tiers },
      benefitsRedeemed: redeemed,
      benefitsRedeemedBySponsor: Object.keys(weights).length ? split(redeemed, weights) : {},
      sponsorsActive: sponsorIds.length,
    };
  });
}

// metricsMonthly a partir de la serie diaria (solo meses cubiertos completos + el mes en curso).
export function buildMonthly(daily, today = todayInSantiago()) {
  const byMonth = new Map();
  for (const d of daily) {
    const ym = d.date.slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(d);
  }
  const currentYm = today.slice(0, 7);
  const out = [];
  for (const [ym, rows] of byMonth) {
    const complete = rows.length === daysInMonth(ym);
    if (ym !== currentYm && !complete) continue; // primer mes parcial
    const lastRow = rows[rows.length - 1];
    const sum = (f) => rows.reduce((s, x) => s + f(x), 0);
    const tiers = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
    out.push({
      month: ym,
      closed: ym !== currentYm,
      daysAggregated: rows.length,
      downloads: { total: sum((x) => x.downloads.total), ios: sum((x) => x.downloads.ios), android: sum((x) => x.downloads.android), web: 0 },
      downloadsTotalToDate: lastRow.downloadsTotalToDate,
      dauAvg: Math.round(sum((x) => x.dau) / rows.length),
      mau: lastRow.mau,
      registrations: sum((x) => x.registrations), registeredToDate: lastRow.registeredToDate,
      conversions: sum((x) => x.conversions), convertedToDate: lastRow.convertedToDate,
      convRate: Math.round((lastRow.convertedToDate / lastRow.mau) * 1000) / 10,
      mrr: lastRow.mrr, revenueByPlan: lastRow.revenueByPlan,
      badgesIssued: { total: sum((x) => x.badgesIssued.total), ...Object.fromEntries(tiers.map((t) => [t, sum((x) => x.badgesIssued[t])])) },
      benefitsRedeemed: sum((x) => x.benefitsRedeemed),
      sponsorsActive: lastRow.sponsorsActive,
    });
  }
  return out;
}

// Escribe metricsDaily (últimos 90 días) y metricsMonthly en Firestore. Idempotente (set por ID).
export async function writeSyntheticMetrics(db, { sponsorIds = [], now = new Date() } = {}) {
  const today = todayInSantiago(now);
  const series = buildDailySeries({ sponsorIds, today });
  const monthly = buildMonthly(series, today);
  const gen = new Date(now);
  const plusYears = (iso, y) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + y); return d; };
  let batch = db.batch(); let n = 0;
  const flush = async () => { await batch.commit(); batch = db.batch(); n = 0; };
  for (const d of series.slice(-KEEP_DAILY)) {
    batch.set(db.collection('metricsDaily').doc(d.date), { ...d, synthetic: true, generatedAt: gen, expiresAt: plusYears(d.date, 3) });
    n += 1; if (n >= 400) await flush();
  }
  for (const m of monthly) {
    batch.set(db.collection('metricsMonthly').doc(m.month), { ...m, synthetic: true, generatedAt: gen });
    n += 1; if (n >= 400) await flush();
  }
  if (n) await flush();
  return { daily: Math.min(KEEP_DAILY, series.length), monthly: monthly.length };
}

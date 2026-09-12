import { Router } from 'express';
import { ok } from '../lib/envelope.js';
import { wrap } from '../middleware/error.js';
import { requireRole } from '../middleware/auth.js';
import { COL, getDoc } from '../data/repo.js';
import { logAudit } from '../lib/audit.js';

const r = Router();

// Factor de escala por rango respecto de la base sembrada (equivalente a 30 días).
// El proyecto no tiene aún un pipeline real de eventos por usuario/pago (ver
// sección 5 del plan, "Dependencias de datos"), así que mientras eso no exista,
// el rango escala de forma determinística todos los acumulados/conteos (descargas,
// usuarios activos, recaudación, embudo, badges). Los porcentajes/tasas (deltaPct,
// % de conversión) NO se escalan: son una razón entre dos acumulados que ya
// escalan por el mismo factor, así que su valor no debería cambiar con el rango.
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

// GET /admin/metrics/overview  (cualquier rol administrativo)
// "Resumen" es la portada de la consola para los cuatro roles, así que el
// resumen ejecutivo tiene que ser legible por todos ellos (admin pasa siempre).
// ?range= 7d | 30d | 90d | 12m — recalcula los acumulados del período seleccionado.
r.get('/metrics/overview', requireRole('finance', 'ops', 'support'), wrap(async (req, res) => {
  const range = rangeFromQuery(req.query.range);
  const doc = await getDoc(COL.metrics, 'overview');
  const scaled = doc ? scaleOverview(doc, RANGE_FACTORS[range]) : {};
  return ok(res, scaled, 200, { range });
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
  const doc = await getDoc(COL.metrics, 'commercial');
  const scaled = doc ? scaleCommercial(doc, RANGE_FACTORS[range]) : {};
  // La recaudación es información sensible: queda registrado quién la consultó (D-BE-402).
  await logAudit(req, 'view', 'metrics/commercial', { range });
  return ok(res, scaled, 200, { range });
}));

export default r;

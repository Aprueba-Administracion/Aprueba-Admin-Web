import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Kpi, Card, Loading, LineChart, Funnel, Bars, HBars, COIN, ErrorBox, Select } from '../components/ui.jsx';

const RANGES = ['7d', '30d', '90d', '12m'];
const RANGE_LABEL_TEXT = {
  es: { '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', '90d': 'Últimos 90 días', '12m': 'Últimos 12 meses' },
  en: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '12m': 'Last 12 months' },
};

// Arma y descarga un CSV con las métricas comerciales visibles en pantalla,
// respetando el rango seleccionado (D-FE-402).
function downloadCommercialCsv(d, range, isEn) {
  const rows = [];
  rows.push([isEn ? 'Metric' : 'Métrica', isEn ? 'Value' : 'Valor']);
  rows.push([isEn ? 'Range' : 'Rango', RANGE_LABEL_TEXT[isEn ? 'en' : 'es'][range]]);
  rows.push([isEn ? 'Downloads' : 'Descargas', d.downloads]);
  rows.push(['DAU', d.dau]);
  rows.push(['MAU', d.mau]);
  rows.push([isEn ? 'Converted' : 'Convertidos', d.converted]);
  rows.push([isEn ? 'Conversion rate' : 'Tasa de conversión', `${d.convRate}%`]);
  rows.push(['MRR', d.mrr]);
  rows.push([isEn ? 'Benefits redeemed' : 'Beneficios canjeados', d.benefitsRedeemed]);
  rows.push([]);
  rows.push([isEn ? 'Funnel step' : 'Paso del embudo', isEn ? 'Value' : 'Valor']);
  for (const f of d.funnel || []) rows.push([f.label, f.value]);
  rows.push([]);
  rows.push([isEn ? 'Revenue by plan' : 'Recaudación por plan', isEn ? 'Value' : 'Valor']);
  for (const p of d.revenueByPlan || []) rows.push([p.plan, p.value]);
  rows.push([]);
  rows.push([isEn ? 'Badges by tier' : 'Badges por tipo', isEn ? 'Value' : 'Valor']);
  for (const b of d.badgesByType || []) rows.push([b.tier, b.value]);

  // Solo se entrecomilla la celda si lo necesita (tiene coma, comillas o salto de línea);
  // así los números quedan como números de verdad en Excel, no como texto.
  const escapeCell = (cell) => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  // El BOM (﻿) es lo que le indica a Excel que el archivo es UTF-8;
  // sin él, interpreta las tildes/ñ con el charset equivocado.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metricas_comerciales_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Commercial({ ctx }) {
  const { L, fmt } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const [range, setRange] = useState('30d');
  const [d, setD] = useState(null);
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState(null);

  const load = async (r) => {
    setErr(null);
    try {
      // Se piden juntos para no renderizar con la serie mensual a medias.
      // La serie vive en el resumen, ya legible por finanzas.
      const [c, o] = await Promise.all([api.get(`/metrics/commercial?range=${r}`), api.get('/metrics/overview')]);
      setD(c.data); setOv(o.data);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(range); }, [range]);

  if (err) return <Card><ErrorBox msg={err} onRetry={() => load(range)} L={L} /></Card>;
  if (!d || !ov) return <Loading L={L} />;

  const months = ov?.downloadsByMonth || [];
  const planColor = { uni: 'var(--brand)', all: 'var(--cta)' };
  const revBars = (d.revenueByPlan || []).map((r) => ({ label: r.plan, value: r.value, color: planColor[r.plan] || 'var(--brand)', disp: '$' + fmt(r.value) }));
  const badgeBars = (d.badgesByType || []).map((b) => ({ label: `${COIN[b.tier]} ${L('tier_' + b.tier)}`, value: b.value, disp: fmt(b.value), color: `var(--${b.tier})` }));

  return (
    <>
      <div className="flex between wrap" style={{ gap: 10, marginBottom: 14 }}>
        <Select
          value={range}
          onChange={setRange}
          options={RANGES.map((rg) => ({ value: rg, label: RANGE_LABEL_TEXT[isEn ? 'en' : 'es'][rg] }))}
        />
        <button className="btn sec sm" onClick={() => downloadCommercialCsv(d, range, isEn)}>
          ⬇️ {isEn ? 'Export CSV' : 'Exportar CSV'}
        </button>
      </div>
      <div className="grid g4">
        <Kpi ic="⬇️" label={L('k_downloads')} value={fmt(d.downloads)} up />
        <Kpi ic="👤" label={L('k_dau')} value={fmt(d.dau)} />
        <Kpi ic="📈" label={L('k_mau')} value={fmt(d.mau)} up />
        <Kpi ic="⭐" label={L('k_converted')} value={`${fmt(d.converted)} · ${d.convRate}%`} up />
        <Kpi ic="💰" label={L('k_mrr')} value={`$${fmt(d.mrr)}`} up />
        <Kpi ic="🎁" label={L('k_benefits')} value={fmt(d.benefitsRedeemed)} />
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card><b>{L('c_downloads_trend')}</b><LineChart vals={months.map((m) => m.value)} labels={months.map((m) => m.month)} /></Card>
        <Card><b>{L('c_funnel')}</b><Funnel data={(d.funnel || []).map((f) => ({ label: `${f.label}: ${fmt(f.value)}`, value: f.value }))} /></Card>
        <Card>
          <b>{L('c_rev_plan')}</b><Bars data={revBars} />
          <div className="flex between note" style={{ marginTop: 6 }}><span>{L('c_rev_total')}</span><b style={{ color: 'var(--ink)' }}>${fmt(d.mrr)}{L('mo')}</b></div>
        </Card>
        <Card><b>{L('c_badges_type')}</b><HBars data={badgeBars} /></Card>
      </div>
    </>
  );
}

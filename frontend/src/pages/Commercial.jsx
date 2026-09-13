import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { api } from '../api/client.js';
import {
  KpiTrend, Card, Loading, ErrorBox, Tabs,
  LineChartInteractive, RankList, MiniMonthBars, Funnel, HBarsInteractive, BarsInteractive, DonutMulti, CAT_COLORS, COIN,
} from '../components/ui.jsx';

const RANGES = ['7d', '30d', '90d', '12m'];
const RANGE_LABEL_TEXT = {
  es: { '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', '90d': 'Últimos 90 días', '12m': 'Últimos 12 meses' },
  en: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', '12m': 'Last 12 months' },
};
const RANGE_PILL_KEY = { '7d': 'com_range_7d', '30d': 'com_range_30d', '90d': 'com_range_90d', '12m': 'com_range_12m' };
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };

// Calcula una ventana de fechas "hasta hoy" para mostrar junto al selector de
// rango. Es una insignia informativa: los datos siguen siendo los de ejemplo
// sembrados en la base, esto solo ubica visualmente qué ventana se está viendo.
function dateRangeLabel(range, locale) {
  const end = new Date();
  const start = new Date(end.getTime() - RANGE_DAYS[range] * 86400000);
  const fmt = (d) => d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  const year = end.getFullYear();
  return `${fmt(start)} – ${fmt(end)} ${year}`;
}

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

const PLAN_LABEL = { uni: { es: '1 prueba', en: 'One test' }, all: { es: 'Todas las pruebas', en: 'All tests' } };

export default function Commercial({ ctx }) {
  const { L, fmt } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const locale = isEn ? 'en-US' : 'es-CL';
  const [range, setRange] = useState('30d');
  const [tab, setTab] = useState('resumen');
  const [d, setD] = useState(null);
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState(null);
  const [embudoView, setEmbudoView] = useState('steps');

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

  const months = ov?.downloadsByMonth || [];
  // Se usan tal cual (mismos valores) en cada KpiTrend/gráfico de las 4
  // pestañas — antes se recalculaban con un `months.map(...)` nuevo en cada
  // uno; ahora se sacan una sola vez y se reutiliza la misma referencia.
  const monthVals = useMemo(() => months.map((m) => m.value), [months]);
  const monthLabels = useMemo(() => months.map((m) => m.month), [months]);

  const revBars = useMemo(() => (d?.revenueByPlan || []).map((r, i) => ({
    label: PLAN_LABEL[r.plan]?.[isEn ? 'en' : 'es'] || r.plan,
    value: r.value, color: CAT_COLORS[i % CAT_COLORS.length], disp: '$' + fmt(r.value),
  })), [d, isEn, fmt]);

  const badgeBars = useMemo(() => (d?.badgesByType || []).map((b) => ({
    label: `${COIN[b.tier]} ${L('tier_' + b.tier)}`, value: b.value, disp: fmt(b.value), color: `var(--${b.tier})`,
  })), [d, L, fmt]);

  if (err) return <Card><ErrorBox msg={err} onRetry={() => load(range)} L={L} /></Card>;
  if (!d || !ov) return <Loading L={L} />;

  // Usado por la tarjeta "Tasa de conversión" de la pestaña Conversión: antes
  // se calculaba dos veces seguidas (una para el valor, otra para el texto).
  const notConverted = Math.max((d.mau || 0) - (d.converted || 0), 0);

  const TABS = [
    { id: 'resumen', label: L('com_tab_resumen') },
    { id: 'adquisicion', label: L('com_tab_adq') },
    { id: 'conversion', label: L('com_tab_conv') },
    { id: 'ingresos', label: L('com_tab_ing') },
  ];

  return (
    <>
      <div className="flex between wrap" style={{ gap: 10, marginBottom: 16 }}>
        <div className="flex wrap" style={{ gap: 10 }}>
          <div className="range-pills">
            {RANGES.map((rg) => (
              <button key={rg} type="button" className={`range-pill ${range === rg ? 'act' : ''}`} onClick={() => setRange(rg)}>
                {L(RANGE_PILL_KEY[rg])}
              </button>
            ))}
          </div>
          <span className="date-badge">📅 {dateRangeLabel(range, locale)}</span>
        </div>
        <button className="btn sec sm" onClick={() => downloadCommercialCsv(d, range, isEn)}>
          ⬇️ {isEn ? 'Export CSV' : 'Exportar CSV'}
        </button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'resumen' && (
        <>
          <div className="com-layout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <Card>
                <b>{L('com_downloads_total')}</b>
                <div style={{ marginTop: 10 }}>
                  <LineChartInteractive
                    vals={monthVals}
                    labels={monthLabels}
                    format={(v) => fmt(v)}
                  />
                </div>
              </Card>

              <div className="grid g2">
                <Card>
                  <b>{L('k_mrr')}</b>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginTop: 6 }}>
                    ${fmt(d.mrr)}
                  </div>
                  {ov.mrr?.deltaPct != null && (
                    <div className="dl up" style={{ marginTop: 2, marginBottom: 4 }}>▲ {ov.mrr.deltaPct}% {L('vs_prev')}</div>
                  )}
                  <MiniMonthBars vals={monthVals} labels={monthLabels} />
                </Card>
                <Card>
                  <div className="flex between" style={{ marginBottom: 4 }}>
                    <b>{L('com_top_plans')}</b>
                    <span
                      className="note"
                      style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setTab('ingresos')}
                    >
                      {L('com_see_all')} →
                    </span>
                  </div>
                  <RankList data={revBars} />
                </Card>
              </div>
            </div>

            <div className="com-side">
              <KpiTrend ic="⬇️" label={L('k_downloads')} value={fmt(d.downloads)}
                delta={ov.downloads?.deltaPct != null ? `${ov.downloads.deltaPct}% ${L('vs_prev')}` : null}
                spark={monthVals} />
              <KpiTrend ic="👤" label={L('k_dau')} value={fmt(d.dau)} spark={monthVals} />
              <KpiTrend ic="📈" label={L('k_mau')} value={fmt(d.mau)}
                delta={ov.mau?.deltaPct != null ? `${ov.mau.deltaPct}% ${L('vs_prev')}` : null}
                spark={monthVals} />
              <KpiTrend ic="⭐" label={L('k_converted')} value={`${fmt(d.converted)} · ${d.convRate}%`}
                delta={`${d.convRate}% ${L('conv_of_mau')}`} spark={monthVals} />

              <Card>
                <b>{L('com_plan_dist')}</b>
                <DonutMulti data={revBars} centerLabel={`$${fmt(d.mrr)}`} />
              </Card>
            </div>
          </div>

          <div className="tip-banner">
            <span className="ic">💡</span>
            <span style={{ flex: 1 }}>{L('com_tip')}</span>
            <span className="chev" aria-hidden="true">›</span>
          </div>
        </>
      )}

      {tab === 'adquisicion' && (
        <>
          <div className="grid g4">
            <KpiTrend ic="⬇️" label={L('k_downloads')} value={fmt(d.downloads)}
              delta={ov.downloads?.deltaPct != null ? `${ov.downloads.deltaPct}% ${L('vs_prev')}` : null}
              spark={monthVals} />
            <KpiTrend ic="👤" label={L('k_dau')} value={fmt(d.dau)} spark={monthVals} />
            <KpiTrend ic="📈" label={L('k_mau')} value={fmt(d.mau)}
              delta={ov.mau?.deltaPct != null ? `${ov.mau.deltaPct}% ${L('vs_prev')}` : null}
              spark={monthVals} />
            <KpiTrend ic="🎁" label={L('k_benefits')} value={fmt(d.benefitsRedeemed)} spark={monthVals} />
          </div>
          <Card style={{ marginTop: 16 }}>
            <b>{L('com_downloads_total')}</b>
            <div style={{ marginTop: 10 }}>
              <LineChartInteractive vals={monthVals} labels={monthLabels} format={(v) => fmt(v)} />
            </div>
          </Card>
        </>
      )}

      {tab === 'conversion' && (
        <>
          <div className="grid g4">
            <KpiTrend ic="⭐" label={L('k_converted')} value={fmt(d.converted)}
              delta={`${d.convRate}% ${L('conv_of_mau')}`} spark={monthVals} />
            <KpiTrend ic="👤" label={L('k_dau')} value={fmt(d.dau)} spark={monthVals} />
            <KpiTrend ic="📈" label={L('k_mau')} value={fmt(d.mau)}
              delta={ov.mau?.deltaPct != null ? `${ov.mau.deltaPct}% ${L('vs_prev')}` : null}
              spark={monthVals} />
            <KpiTrend ic="🎁" label={L('k_benefits')} value={fmt(d.benefitsRedeemed)} spark={monthVals} />
          </div>
          <div className="grid g2" style={{ marginTop: 16 }}>
            <Card>
              <div className="flex between">
                <b>{L('c_funnel')}</b>
                <button
                  type="button"
                  className="btn sec sm"
                  onClick={() => setEmbudoView((v) => (v === 'steps' ? 'circular' : 'steps'))}
                >
                  {embudoView === 'steps' ? (isEn ? '◔ Circular' : '◔ Ver circular') : (isEn ? '▤ Steps' : '▤ Ver escalones')}
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                {embudoView === 'steps' ? (
                  <Funnel data={(d.funnel || []).map((f) => ({ label: f.label, value: f.value }))} format={(v) => fmt(v)} />
                ) : (
                  <DonutMulti
                    data={(d.funnel || []).map((f, i) => ({
                      label: f.label, value: f.value, color: CAT_COLORS[i % CAT_COLORS.length], disp: fmt(f.value),
                    }))}
                    centerLabel={`${d.convRate || 0}%`}
                  />
                )}
              </div>
            </Card>
            <Card>
              <b>{isEn ? 'Conversion rate' : 'Tasa de conversión'}</b>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <DonutMulti
                  data={[
                    { label: isEn ? 'Converted' : 'Convertidos', value: d.converted || 0, color: 'var(--brand)', disp: fmt(d.converted || 0) },
                    { label: isEn ? 'Not converted' : 'No convertidos', value: notConverted, color: 'var(--line)', disp: fmt(notConverted) },
                  ]}
                  centerLabel={`${d.convRate || 0}%`}
                />
              </div>
              <div className="note" style={{ textAlign: 'center', marginTop: 8 }}>
                {fmt(d.converted)} {isEn ? 'of' : 'de'} {fmt(d.mau)} MAU
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'ingresos' && (
        <>
          <div className="grid g4">
            <KpiTrend ic="💰" label={L('k_mrr')} value={`$${fmt(d.mrr)}`}
              delta={ov.mrr?.deltaPct != null ? `${ov.mrr.deltaPct}% ${L('vs_prev')}` : null}
              spark={monthVals} />
            <KpiTrend ic="🎁" label={L('k_benefits')} value={fmt(d.benefitsRedeemed)} spark={monthVals} />
            <KpiTrend ic="⭐" label={L('k_converted')} value={`${fmt(d.converted)} · ${d.convRate}%`} spark={monthVals} />
            <KpiTrend ic="📈" label={L('k_mau')} value={fmt(d.mau)} spark={monthVals} />
          </div>
          <Card style={{ marginTop: 16 }}>
            <b>{L('c_rev_plan')}</b>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 420 }}>
                <BarsInteractive data={revBars} />
              </div>
            </div>
            <div className="flex between note" style={{ marginTop: 6 }}><span>{L('c_rev_total')}</span><b style={{ color: 'var(--ink)' }}>${fmt(d.mrr)}{L('mo')}</b></div>
          </Card>
          <Card style={{ marginTop: 16 }}>
            <b>{L('c_badges_type')}</b>
            <div style={{ marginTop: 10 }}>
              <HBarsInteractive data={badgeBars} />
            </div>
          </Card>
        </>
      )}
    </>
  );
}

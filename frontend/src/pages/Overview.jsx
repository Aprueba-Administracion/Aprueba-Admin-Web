import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Card, StatusPill, Loading, LineChartInteractive, Funnel, DonutMulti, BarsInteractive, CAT_COLORS, ErrorBox } from '../components/ui.jsx';

const PLAN_LABEL = { uni: { es: '1 prueba', en: 'One test' }, all: { es: 'Todas las pruebas', en: 'All tests' } };

// El color por defecto es 'currentColor': la línea hereda el tono que le da la
// clase .kpi-tile.<tono> .kpi-spark del contenedor, en vez de un valor fijo
// pensado para fondo oscuro (así también se ve bien sobre el fondo claro nuevo).
function Sparkline({ color = 'currentColor', width = 70, height = 22 }) {
  return (
    <svg viewBox="0 0 100 24" width={width} height={height} style={{ overflow: 'visible' }}>
      <path
        d="M 2,18 Q 20,22 35,16 T 65,10 T 85,14 T 98,4"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Iconos SVG nítidos de fondo ──
function IconDownloadBig({ size = 95 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconUsersBig({ size = 95 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconStarBig({ size = 95 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconCashBig({ size = 95 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

// Icono claro de patrocinio / apoyo (corazón / partnership)
function IconSponsorHeartBig({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconBadgeMedalBig({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="m8.21 13.89-1.21 7.11 5-3 5 3-1.21-7.11" />
    </svg>
  );
}

// ── KPI Superior (Descargas, MAU, etc.) ──
// Mismo tratamiento que las tarjetas de Sponsors: fondo predominantemente blanco
// con un degradado suave del color de la métrica (var(--kpi-<tono>-*) en
// styles.css) y el ícono grande detrás, en vez de un color sólido fijo. Así
// también queda correcto en modo oscuro sin duplicar estilos por tema aquí.
function TopKpiCard({ label, value, delta, icon: IconComponent, tone }) {
  return (
    <div className={`kpi-tile ${tone}`}>
      <div className="kpi-ic"><IconComponent /></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {delta && <div className="kpi-delta up">▲ {delta}</div>}
      </div>

      <div className="kpi-spark">
        <Sparkline width="100%" height={24} />
      </div>
    </div>
  );
}

// ── KPI Lateral Compacto (Sponsors activos / Badges) ──
function SideKpiCard({ label, value, delta, icon: IconComponent, tone }) {
  return (
    <div className={`kpi-tile compact ${tone}`}>
      <div className="kpi-ic"><IconComponent /></div>

      <div className="kpi-label">{label}</div>

      <div className="kpi-row">
        <div className="kpi-val">{value}</div>
        {delta && <div className="kpi-delta up">▲ {delta}</div>}
      </div>

      <div className="kpi-spark compact-spark">
        <Sparkline width="100%" height={18} />
      </div>
    </div>
  );
}

export default function Overview({ ctx }) {
  const { L, fmt, lang } = ctx;
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [services, setServices] = useState([]);
  const [range, setRange] = useState('30d');
  const [err, setErr] = useState(null);
  const [embudoView, setEmbudoView] = useState('steps');

  const isEn = lang === 'en';

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await api.get(`/metrics/overview?range=${range}`);
      setD(res.data);

      try {
        const sRes = await api.get('/services');
        setServices(sRes.data || []);
      } catch {
        setServices([]);
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!d) return <Loading L={L} />;

  const revBars = (d.revenueByPlan || []).map((r, i) => ({
    label: PLAN_LABEL[r.plan]?.[isEn ? 'en' : 'es'] || r.plan,
    value: r.value,
    color: CAT_COLORS[i % CAT_COLORS.length],
    disp: '$' + fmt(r.value),
  }));

  const thisMonthText = isEn ? 'this month' : 'este mes';
  const vsPrevText = isEn ? 'vs previous period' : 'vs. mes previo';
  const convRateText = isEn ? 'of MAU converted' : 'de MAU convertidos';
  const convPct = d.converted?.rate || 12.8;

  return (
    <>
      {/* Barra superior con selector de rango */}
      <div className="flex between" style={{ alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>{isEn ? 'Overview' : 'Resumen'}</h2>
        <div className="flex" style={{ gap: 6 }}>
          {['7d', '30d', '90d'].map((r) => (
            <button
              key={r}
              type="button"
              className={`btn sm ${range === r ? 'act' : 'sec'}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPIs principales */}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <TopKpiCard
          label={isEn ? 'Total downloads' : 'Descargas totales'}
          value={fmt(d.downloads?.total)}
          delta={`${fmt(d.downloads?.month)} ${thisMonthText}`}
          icon={IconDownloadBig}
          tone="blue"
        />
        <TopKpiCard
          label={isEn ? 'Monthly active (MAU)' : 'Activos mensuales (MAU)'}
          value={fmt(d.mau?.value)}
          delta={`${d.mau?.deltaPct || 6.4}% ${vsPrevText}`}
          icon={IconUsersBig}
          tone="blue"
        />
        <TopKpiCard
          label={isEn ? 'Converted to paid' : 'Convertidos a pago'}
          value={fmt(d.converted?.value)}
          delta={`${convPct}% ${convRateText}`}
          icon={IconStarBig}
          tone="blue"
        />
        <TopKpiCard
          label={isEn ? 'Monthly revenue' : 'Recaudación mensual'}
          value={`$${fmt(d.mrr?.value)}`}
          delta={`${d.mrr?.deltaPct || 9.1}% ${vsPrevText}`}
          icon={IconCashBig}
          tone="blue"
        />
      </div>

      {/* Fila intermedia: Descargas + Embudo */}
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Card className="span2">
          <div className="flex between" style={{ marginBottom: 12 }}>
            <b>{isEn ? 'Downloads per month' : 'Descargas por mes'}</b>
            <span className="note">{thisMonthText}: {fmt(d.downloads?.month)}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <LineChartInteractive
              vals={(d.downloadsByMonth || []).map((m) => m.value)}
              labels={(d.downloadsByMonth || []).map((m) => m.month)}
              format={(v) => fmt(v)}
            />
          </div>
        </Card>

        <Card>
          <div className="flex between">
            <b>{isEn ? 'Conversion funnel' : 'Embudo de conversión'}</b>
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
              <Funnel
                data={[
                  { label: isEn ? 'Downloads' : 'Descargas', value: d.downloads?.total || 0 },
                  { label: 'MAU', value: d.mau?.value || 0 },
                  { label: isEn ? 'Converted' : 'Convertidos', value: d.converted?.value || 0 },
                ]}
                format={(v) => fmt(v)}
              />
            ) : (
              <DonutMulti
                data={[
                  { label: isEn ? 'Downloads' : 'Descargas', value: d.downloads?.total || 0, color: 'var(--brand)', disp: fmt(d.downloads?.total || 0) },
                  { label: 'MAU', value: d.mau?.value || 0, color: 'var(--accent)', disp: fmt(d.mau?.value || 0) },
                  { label: isEn ? 'Converted' : 'Convertidos', value: d.converted?.value || 0, color: 'var(--cta)', disp: fmt(d.converted?.value || 0) },
                ]}
                centerLabel={`${convPct}%`}
              />
            )}
          </div>
        </Card>
      </div>

      {/* Fila inferior */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: '16px' }}>
        {/* Salud del sistema */}
        <Card>
          <div className="flex between" style={{ marginBottom: 12 }}>
            <b>{isEn ? 'System health' : 'Estado del sistema'}</b>
          </div>
          {services.map((s) => (
            <div key={s.id} className="flex between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{s.name}</span>
              <StatusPill state={s.state} L={L} />
            </div>
          ))}
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <span
              className="note link-action"
              onClick={() => nav('/operativa')}
            >
              {isEn ? 'View detail' : 'Ver detalle'} <span className="arw">→</span>
            </span>
          </div>
        </Card>

        {/* Recaudación por plan */}
        <Card>
          <div className="flex between" style={{ marginBottom: 12 }}>
            <b>{isEn ? 'Revenue by plan' : 'Recaudación por plan'}</b>
            <span className="note">›</span>
          </div>
          <BarsInteractive data={revBars} />
        </Card>

        {/* Columna derecha compacta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SideKpiCard
            label={isEn ? 'Active sponsors' : 'Sponsors activos'}
            value={fmt(d.sponsorsActive)}
            delta="20%"
            icon={IconSponsorHeartBig}
            tone="blue"
          />

          <SideKpiCard
            label={isEn ? 'Issued badges' : 'Badges emitidos'}
            value={fmt(d.badgesIssued)}
            delta="4%"
            icon={IconBadgeMedalBig}
            tone="blue"
          />
        </div>
      </div>
    </>
  );
}
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { Card, StatusPill, Loading, LineChartInteractive, Funnel, DonutMulti, BarsInteractive, CAT_COLORS, ErrorBox } from '../components/ui.jsx';

const PLAN_LABEL = { uni: { es: '1 prueba', en: 'One test' }, all: { es: 'Todas las pruebas', en: 'All tests' } };

function Sparkline({ color = 'var(--brand)' }) {
  return (
    <svg viewBox="0 0 120 28" width="100%" height="28" style={{ overflow: 'visible' }}>
      <path
        d="M 2,20 Q 20,24 35,18 T 70,12 T 95,16 T 118,4"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StyledKpi({ icon, label, value, delta, sparkColor }) {
  return (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'var(--soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            marginBottom: 12,
          }}
        >
          {icon}
        </div>
        <div className="lbl" style={{ marginBottom: 4 }}>{label}</div>
        <div className="kpi-val" style={{ fontSize: '24px', letterSpacing: '-0.5px' }}>{value}</div>
        {delta && (
          <div className="dl up" style={{ marginTop: 4 }}>
            ▲ {delta}
          </div>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <Sparkline color={sparkColor} />
      </div>
    </Card>
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
      <div className="flex between" style={{ alignItems: 'center', marginBottom: 20 }}>
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

      {/* 4 KPIs temáticos */}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <StyledKpi
          icon="📥"
          label={isEn ? 'Total downloads' : 'Descargas totales'}
          value={fmt(d.downloads?.total)}
          delta={`${fmt(d.downloads?.month)} ${thisMonthText}`}
          sparkColor="var(--brand)"
        />
        <StyledKpi
          icon="👥"
          label={isEn ? 'Monthly active (MAU)' : 'Activos mensuales (MAU)'}
          value={fmt(d.mau?.value)}
          delta={`${d.mau?.deltaPct || 6.4}% ${vsPrevText}`}
          sparkColor="#10B981"
        />
        <StyledKpi
          icon="⭐"
          label={isEn ? 'Converted to paid' : 'Convertidos a pago'}
          value={fmt(d.converted?.value)}
          delta={`${convPct}% ${convRateText}`}
          sparkColor="var(--accent)"
        />
        <StyledKpi
          icon="💰"
          label={isEn ? 'Monthly revenue' : 'Recaudación mensual'}
          value={`$${fmt(d.mrr?.value)}`}
          delta={`${d.mrr?.deltaPct || 9.1}% ${vsPrevText}`}
          sparkColor="#A855F7"
        />
      </div>

      {/* Fila intermedia: Gráfico de Descargas + Embudo con leyenda */}
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

      {/* Fila inferior: Salud del sistema + Recaudación por plan + Tarjetas Sponsors/Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: '16px' }}>
        {/* Estado del sistema */}
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
              className="note"
              style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => nav('/operativa')}
            >
              {isEn ? 'View detail' : 'Ver detalle'} →
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

        {/* Columna derecha: Sponsors y Badges independientes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Card style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🤝
              </div>
              <span className="lbl">{isEn ? 'Active sponsors' : 'Sponsors activos'}</span>
            </div>
            <div className="flex between" style={{ alignItems: 'baseline' }}>
              <div className="kpi-val" style={{ fontSize: '24px' }}>{fmt(d.sponsorsActive)}</div>
              <div style={{ width: '60px' }}>
                <Sparkline color="var(--brand)" />
              </div>
            </div>
            <div className="dl up" style={{ fontSize: '11px', marginTop: 4 }}>
              ▲ 20%
            </div>
          </Card>

          <Card style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🏅
              </div>
              <span className="lbl">{isEn ? 'Issued badges' : 'Badges emitidos'}</span>
            </div>
            <div className="flex between" style={{ alignItems: 'baseline' }}>
              <div className="kpi-val" style={{ fontSize: '24px' }}>{fmt(d.badgesIssued)}</div>
              <div style={{ width: '60px' }}>
                <Sparkline color="var(--brand)" />
              </div>
            </div>
            <div className="dl up" style={{ fontSize: '11px', marginTop: 4 }}>
              ▲ 4%
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
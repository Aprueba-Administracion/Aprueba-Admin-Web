import { useMemo, useEffect, useState, useRef } from 'react';

export function Kpi({ label, value, delta, up, ic }) {
  return (
    <div className="kpi">
      <div className="lbl">{ic} {label}</div>
      <div className="kpi-val">{value}</div>
      {delta ? <div className={`dl ${up ? 'up' : 'dn'}`}>{up ? '▲' : '▼'} {delta}</div> : null}
    </div>
  );
}

// Mini-tendencia decorativa que usan las tarjetas KPI con degradado (Resumen,
// Comercial, Sponsors). El color por defecto es 'currentColor': hereda el
// tono que le da la clase .kpi-tile.<tono> .kpi-spark del contenedor.
export function Sparkline({ color = 'currentColor', width = 70, height = 22 }) {
  return (
    <svg viewBox="0 0 100 24" width={width} height={height} style={{ overflow: 'visible' }}>
      <path d="M 2,18 Q 20,22 35,16 T 65,10 T 85,14 T 98,4" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// Tarjeta KPI con degradado suave del color `tone` (blue|green|purple|orange,
// ver var(--kpi-<tono>-*) en styles.css) y un ícono grande translúcido de
// fondo, en vez de un emoji + color sólido. Mismo tratamiento visual que las
// tarjetas de Resumen/Comercial/Sponsors — úsala en cualquier vista nueva
// para mantener consistencia.
export function TopKpiCard({ label, value, delta, icon: IconComponent, tone }) {
  return (
    <div className={`kpi-tile ${tone}`}>
      <div className="kpi-ic"><IconComponent size={95} /></div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
        {delta && <div className="kpi-delta up">▲ {delta}</div>}
      </div>
    </div>
  );
}

export function Card({ children, className = '', style }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

// KPI con tendencia: valor + variación a la izquierda, mini-sparkline decorativo
// e ícono circular a la derecha (usado en el panel lateral de Comercial).
// `bigIcon` + `tone` activan la variante "tint": en vez del círculo con emoji,
// muestra un ícono grande translúcido de fondo sobre un degradado suave del
// color `tone` (mismo tratamiento que las tarjetas KPI de Resumen/Sponsors),
// sin cambiar el tamaño de la tarjeta. Sin esos props se comporta igual que antes.
export function KpiTrend({ ic, label, value, delta, up = true, spark = [], bigIcon: BigIcon, tone }) {
  const tinted = Boolean(BigIcon && tone);
  // En la variante "tint" la línea de tendencia se dibuja más ancha (0-100) porque
  // ahora ocupa su propia fila bajo el valor, en vez de compartir la franja
  // derecha angosta con el ícono grande de fondo (ahí quedaba encima del ícono).
  const w = tinted ? 100 : 54;
  const path = useMemo(() => {
    if (spark.length < 2) return null;
    const h = 22;
    const max = Math.max(...spark), min = Math.min(...spark), rng = (max - min) || 1;
    const step = w / (spark.length - 1);
    return spark.map((v, i) => [i * step, h - 2 - ((v - min) / rng) * (h - 4)])
      .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  }, [spark, w]);

  if (tinted) {
    return (
      <div className={`card kpi-trend tint ${tone}`}>
        <div className="kt-bigic"><BigIcon size={92} /></div>
        <div className="kt-txt">
          <div className="lbl">{label}</div>
          <div className="kpi-val">{value}</div>
          {delta && <div className={`dl ${up ? 'up' : 'dn'}`}>{up ? '▲' : '▼'} {delta}</div>}
        </div>
        {path && (
          <div className="kt-spark">
            <svg width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none">
              <path d={path} fill="none" stroke={`var(--kpi-${tone}-icon)`} strokeWidth="1.6" opacity=".55" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card kpi-trend">
      <div className="kt-txt">
        <div className="lbl">{label}</div>
        <div className="kpi-val">{value}</div>
        {delta && <div className={`dl ${up ? 'up' : 'dn'}`}>{up ? '▲' : '▼'} {delta}</div>}
      </div>
      <div className="kt-side">
        {path && <svg width="54" height="22" viewBox="0 0 54 22"><path d={path} fill="none" stroke="var(--brand)" strokeWidth="1.6" opacity=".5" /></svg>}
        <span className="kt-ic">{ic}</span>
      </div>
    </div>
  );
}

// Barras mensuales compactas (sin etiquetas de valor), con el último mes resaltado.
export function MiniMonthBars({ vals = [], labels = [] }) {
  const w = 240, h = 92, bottom = 16;
  const max = Math.max(...vals, 0) || 1;
  const n = vals.length || 1, slot = w / n, bw = Math.min(28, slot * 0.5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {vals.map((v, i) => {
        const bh = (v / max) * (h - bottom - 6);
        const x = slot * i + slot / 2 - bw / 2, y = h - bottom - bh;
        const last = i === vals.length - 1;
        return (
          <g key={i}>
            <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bw} height={bh.toFixed(1)} rx="5" fill="var(--brand)" opacity={last ? 1 : 0.28} />
            <text x={(slot * i + slot / 2).toFixed(1)} y={h - 3} fontSize="9" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

const STATE_MAP = {
  ok: ['dot ok', 'st_ok', 'g'], deg: ['dot deg', 'st_deg', 'w'], down: ['dot down', 'st_down', 'd'],
};
export function StatusPill({ state, L }) {
  const m = STATE_MAP[state] || STATE_MAP.ok;
  return (
    <span className={`tag ${m[2]}`} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <span className={m[0]} style={{ marginRight: 5, flexShrink: 0 }} />{L(m[1])}
    </span>
  );
}

// Placeholder tipo "esqueleto": unas barras pulsantes en vez del "…" plano de
// antes. Se usa tanto para páginas completas como dentro de una sola card
// (Users/Tutors), por eso son barras genéricas de distinto ancho en vez de
// imitar una tabla o KPI concretos.
export function Loading({ L }) {
  return (
    <div className="skel-wrap" role="status" aria-label={L ? L('loading') : 'Cargando'}>
      <div className="skel-bar skel-w60" />
      <div className="skel-bar skel-w40" />
      <div className="skel-bar skel-w80" />
      <div className="skel-bar skel-w70" />
      <div className="skel-bar skel-w50" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitivas de interacción (modales, formularios, pestañas, avisos)
// ─────────────────────────────────────────────────────────────────────────────

// Etiqueta genérica de estado tolerante a valores desconocidos: nunca revienta
// si el backend devuelve un estado que el mapa no contempla.
export function Pill({ value, map = {}, L }) {
  const m = map[value];
  return <span className={`tag ${m?.[0] ?? ''}`}>{m ? L(m[1]) : (value ?? '—')}</span>;
}

export function ErrorBox({ msg, onRetry, L }) {
  if (!msg) return null;
  return (
    <div className="err flex between" style={{ marginTop: 0 }}>
      <span>⛔ {msg}</span>
      {onRetry && <button className="btn sec sm" onClick={onRetry}>{L ? L('retry') : 'Reintentar'}</button>}
    </div>
  );
}

export function EmptyState({ msg, ic = '📭' }) {
  return <div className="empty-hint" style={{ padding: '28px 12px' }}>{ic} {msg}</div>;
}

// Aviso flotante autodescartable. `kind`: ok | warn | err
export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(onDone, toast.ms || 3000);
    return () => clearTimeout(id);
  }, [toast, onDone]);
  if (!toast) return null;
  return <div className={`toast ${toast.kind || 'ok'}`}>{toast.msg}</div>;
}

// Hook de conveniencia para el patrón toast de las páginas.
export function useToast() {
  const [toast, setToast] = useState(null);
  return {
    toast,
    clear: () => setToast(null),
    ok: (msg) => setToast({ msg: `✓ ${msg}`, kind: 'ok' }),
    warn: (msg) => setToast({ msg: `⚠ ${msg}`, kind: 'warn' }),
    err: (msg) => setToast({ msg: `⛔ ${msg}`, kind: 'err', ms: 5000 }),
  };
}

export function Modal({ title, subtitle, children, onClose, footer, wide, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, busy]);

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="note">{subtitle}</div>}
          </div>
          <button className="modal-x" onClick={onClose} disabled={busy} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Confirmación con soporte para acciones destructivas.
export function Confirm({ title, message, confirmLabel, cancelLabel, danger, busy, onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={busy}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{cancelLabel}</button>
        <button className={`btn ${danger ? 'dgr' : ''}`} onClick={onConfirm} disabled={busy}>{busy ? '…' : confirmLabel}</button>
      </>}
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

export function Field({ label, hint, children, wide }) {
  return (
    <div className={`field ${wide ? 'span-2' : ''}`}>
      <label>{label}</label>
      {children}
      {hint && <div className="note" style={{ marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

export function FormGrid({ children }) { return <div className="form-grid">{children}</div>; }

export function Select({ value, onChange, options, placeholder, ...rest }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id}
          className={`tab ${active === t.id ? 'act' : ''}`} onClick={() => onChange(t.id)}>
          {t.ic} {t.label}
          {t.count != null && <span className="cnt">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Selección múltiple sobre un catálogo cerrado (modos, criterios…).
export function Chips({ options, value = [], onChange }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o.value} className={`chip ${value.includes(o.value) ? 'on' : ''}`} onClick={() => toggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Lista de etiquetas libre (materias, idiomas): Enter o coma para añadir.
export function TagInput({ value = [], onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const t = String(raw).trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  const free = suggestions.filter((s) => !value.includes(s));
  return (
    <div>
      <div className="chips" style={{ marginBottom: value.length ? 6 : 0 }}>
        {value.map((v) => (
          <span key={v} className="chip on">
            {v}<span className="x" onClick={() => onChange(value.filter((x) => x !== v))}>✕</span>
          </span>
        ))}
      </div>
      <input
        style={{ width: '100%' }}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
      {free.length > 0 && (
        <div className="chips" style={{ marginTop: 6 }}>
          {free.slice(0, 12).map((s) => (
            <button type="button" key={s} className="chip sug" onClick={() => add(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Valoración de solo lectura (0–5, medio punto por barra).
export function Stars({ value = 0, count }) {
  const full = Math.round(Number(value) || 0);
  return (
    <span className="stars" title={`${value}`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= full ? 'on' : ''}>★</span>)}
      <b>{Number(value || 0).toFixed(1)}</b>
      {count != null && <span className="note">({count})</span>}
    </span>
  );
}

// Paginación por cursor del backend (meta.pagination.nextCursor).
export function Pager({ page, shown, total, hasNext, onNext, onPrev, L }) {
  if (!hasNext && page === 0) return null;
  return (
    <div className="pager">
      <span className="note">{L('pg_showing', { shown, total })}</span>
      <div className="flex" style={{ gap: 6 }}>
        <button className="btn sec sm" onClick={onPrev} disabled={page === 0}>← {L('pg_prev')}</button>
        <button className="btn sec sm" onClick={onNext} disabled={!hasNext}>{L('pg_next')} →</button>
      </div>
    </div>
  );
}

export function KV({ k, v }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v ?? '—'}</span></div>;
}

// ── Gráficos SVG inline (mismos del wireframe) ──
export function LineChart({ vals = [], labels = [] }) {
  const path = useMemo(() => {
    const w = 300, h = 96, pad = 8;
    // Con menos de dos puntos no hay línea que trazar: `step` se iría a
    // infinito y el cálculo del área reventaría al leer el último punto.
    if (vals.length < 2) return { empty: true, w, h };
    const max = Math.max(...vals), min = Math.min(...vals), rng = (max - min) || 1;
    const step = (w - pad * 2) / (vals.length - 1);
    const pts = vals.map((v, i) => [pad + i * step, h - 18 - ((v - min) / rng) * (h - 30)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${h - 18} L${pad} ${h - 18} Z`;
    return { d, area, pts, w, h, pad, step };
  }, [vals]);
  if (path.empty) return <svg viewBox={`0 0 ${path.w} ${path.h}`} width="100%" height={path.h} />;
  const { d, area, pts, w, h, pad, step } = path;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={area} fill="var(--brand)" opacity=".12" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="2.5" fill="var(--brand)" />)}
      {labels.map((l, i) => <text key={i} x={(pad + i * step).toFixed(1)} y={h - 4} fontSize="8.5" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">{l}</text>)}
    </svg>
  );
}

export function Bars({ data = [] }) {
  const w = 300, h = 140, bottom = 20;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const n = data.length || 1, slot = w / n, bw = Math.min(40, slot * 0.5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {data.map((d, i) => {
        const bh = (d.value / max) * (h - bottom - 14);
        const x = slot * i + slot / 2 - bw / 2; const y = h - bottom - bh;
        return (
          <g key={i}>
            <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bw} height={bh.toFixed(1)} rx="5" fill={d.color || 'var(--brand)'} />
            <text x={(slot * i + slot / 2).toFixed(1)} y={(y - 4).toFixed(1)} fontSize="8.5" fill="var(--ink)" textAnchor="middle" fontFamily="Montserrat" fontWeight="700">{d.disp}</text>
            <text x={(slot * i + slot / 2).toFixed(1)} y={h - 5} fontSize="8.5" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Barras verticales interactivas ("columnas"): resalta la barra bajo el mouse
// y muestra un tooltip con el valor exacto y el % del total.
export function BarsInteractive({ data = [] }) {
  const [hover, setHover] = useState(null);
  const w = 300, h = 150, bottom = 22;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const total = data.reduce((a, d) => a + (d.value || 0), 0) || 1;
  const n = data.length || 1, slot = w / n, bw = Math.min(46, slot * 0.5);
  const hd = hover != null ? data[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        {data.map((d, i) => {
          const bh = (d.value / max) * (h - bottom - 18);
          const x = slot * i + slot / 2 - bw / 2; const y = h - bottom - bh;
          const active = hover === i;
          return (
            <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={(slot * i).toFixed(1)} y="0" width={slot.toFixed(1)} height={h} fill="transparent" />
              <rect x={x.toFixed(1)} y={y.toFixed(1)} width={bw} height={bh.toFixed(1)} rx="6"
                fill={d.color || 'var(--brand)'} opacity={active ? 1 : 0.85}
                stroke={active ? 'var(--ink)' : 'none'} strokeWidth={active ? 1.5 : 0}
                style={{ transition: 'opacity .15s' }} />
              <text x={(slot * i + slot / 2).toFixed(1)} y={(y - 6).toFixed(1)} fontSize="9.5" fill="var(--ink)" textAnchor="middle" fontFamily="Montserrat" fontWeight="700">{d.disp}</text>
              <text x={(slot * i + slot / 2).toFixed(1)} y={h - 6} fontSize="9.5" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hd && (
        <div className="chart-tip" style={{ top: 6, left: `${((hover + 0.5) / data.length) * 100}%` }}>
          <b>{hd.label}</b>
          <span>{hd.disp} · {((hd.value / total) * 100).toFixed(0)}% del total</span>
        </div>
      )}
    </div>
  );
}

export function Donut({ pct }) {
  const r = 40, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <svg viewBox="0 0 104 104" width="116" height="116">
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 52 52)" />
      <text x="52" y="50" fontSize="19" fontWeight="800" fill="var(--ink)" textAnchor="middle" fontFamily="Montserrat">{pct}%</text>
      <text x="52" y="67" fontSize="8" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">conv.</text>
    </svg>
  );
}

export function HBars({ data = [] }) {
  const w = 300, rowH = 30, labW = 130;
  const max = Math.max(...data.map((d) => d.value), 0) || 1, h = data.length * rowH + 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
      {data.map((d, i) => {
        const bw = (d.value / max) * (w - labW - 46); const y = i * rowH + 5;
        return (
          <g key={i}>
            <text x="0" y={y + 14} fontSize="10" fill="var(--ink)" fontFamily="Inter">{d.label}</text>
            <rect x={labW} y={y + 4} width={Math.max(3, bw).toFixed(1)} height="14" rx="4" fill={d.color || 'var(--brand)'} />
            <text x={(labW + Math.max(3, bw) + 5).toFixed(1)} y={y + 15} fontSize="9" fill="var(--muted)" fontFamily="Inter">{d.disp}</text>
          </g>
        );
      })}
    </svg>
  );
}

export const CAT_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

// Barras horizontales interactivas: resalta la fila y muestra un tooltip con
// el valor exacto y el % del total al pasar el mouse.
export function HBarsInteractive({ data = [] }) {
  const [hover, setHover] = useState(null);
  const w = 340, rowH = 42, labW = 150;
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const h = data.length * rowH + 4;
  const hd = hover != null ? data[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        {data.map((d, i) => {
          const bw = (d.value / max) * (w - labW - 56);
          const y = i * rowH + 6;
          const active = hover === i;
          return (
            <g key={i} style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x="0" y={y - 4} width={w} height={rowH - 4} rx="8" fill={active ? 'var(--soft)' : 'transparent'} />
              <text x="0" y={y + 18} fontSize="13" fill="var(--ink)" fontFamily="Inter" fontWeight={active ? 700 : 500}>{d.label}</text>
              <rect x={labW} y={y + 6} width={Math.max(4, bw).toFixed(1)} height="20" rx="6"
                fill={d.color || 'var(--brand)'} opacity={active ? 1 : 0.85} />
              <text x={(labW + Math.max(4, bw) + 8).toFixed(1)} y={y + 20} fontSize="12" fontWeight="700" fill="var(--ink)" fontFamily="Montserrat">{d.disp}</text>
            </g>
          );
        })}
      </svg>
      {hd && (
        <div className="chart-tip" style={{ top: hover * rowH + 4, left: `${(labW / w) * 100}%` }}>
          <b>{hd.label}</b>
          <span>{hd.disp} · {((hd.value / total) * 100).toFixed(0)}% del total</span>
        </div>
      )}
    </div>
  );
}

// Donut multi-serie interactivo: total al centro, resalta segmento (sin cambiar
// su grosor — solo atenúa los demás) y leyenda siempre visible.
// `pctPill`: variante opcional donde el % va como una píldora de color junto
// al valor (en vez de texto plano entre la etiqueta y el valor) — opt-in para
// no cambiar el aspecto de los usos existentes (Comercial/Sponsors).
export function DonutMulti({ data = [], centerLabel, pctPill = false }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((a, d) => a + (d.value || 0), 0) || 1;
  const r = 40, c = 2 * Math.PI * r;
  let acc = 0;
  const segs = data.map((d, i) => {
    const frac = (d.value || 0) / total;
    const seg = { ...d, i, dash: frac * c, offset: acc * c };
    acc += frac;
    return seg;
  });
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, justifyContent: 'center' }}>
      <svg viewBox="0 0 104 104" width="140" height="140">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
        {segs.map((s) => {
          const dim = hover != null && hover !== s.i;
          return (
            <circle key={s.i} cx="52" cy="52" r={r} fill="none" stroke={s.color || 'var(--brand)'}
              strokeWidth="14"
              strokeDasharray={`${s.dash.toFixed(1)} ${(c - s.dash).toFixed(1)}`}
              strokeDashoffset={(-s.offset).toFixed(1)} transform="rotate(-90 52 52)"
              opacity={dim ? 0.28 : 1}
              style={{
                cursor: 'pointer',
                transition: 'opacity .15s, filter .15s',
                filter: hover === s.i ? 'drop-shadow(0 0 3px rgba(0,0,0,.35))' : 'none',
              }}
              onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)} />
          );
        })}
        <text x="52" y="49" fontSize="13" fontWeight="800" fill="var(--ink)" textAnchor="middle" fontFamily="Montserrat">
          {hover != null ? segs[hover].disp : (centerLabel ?? '')}
        </text>
        <text x="52" y="63" fontSize="6.5" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">
          {hover != null ? segs[hover].label : 'total'}
        </text>
      </svg>
      <div className={`chart-legend ${pctPill ? 'roomy' : ''}`}>
  {segs.map((s) => {
    const pct = Math.round(((s.value || 0) / total) * 100);
    const color = s.color || 'var(--brand)';
    return (
      <div key={s.i} className={`chart-legend-item ${pctPill ? 'roomy' : ''} ${hover === s.i ? 'hover' : ''}`}
        onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)}>
        <span className="dot" style={{ background: color }} />
        <span>{s.label}</span>
        {pctPill ? (
          <>
            <b>{s.disp}</b>
            <span className="pct-pill" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{pct}%</span>
          </>
        ) : (
          <>
            <span className="pct">{pct}%</span>
            <b>{s.disp}</b>
          </>
        )}
      </div>
    );
  })}
</div>
    </div>
  );
}

// Redondea el máximo del eje Y a un valor "lindo" (1/2/2.5/5/10 × 10^n) y
// devuelve los cortes intermedios, para que el gráfico tenga un grid legible
// en vez de marcas con decimales raros.
function niceAxis(rawMax, nIntervals = 4) {
  if (rawMax <= 0) return { niceMax: 1, values: [0, 1] };
  const rough = rawMax / nIntervals;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / mag;
  let s;
  if (n <= 1) s = 1;
  else if (n <= 2) s = 2;
  else if (n <= 2.5) s = 2.5;
  else if (n <= 5) s = 5;
  else s = 10;
  const step = s * mag;
  const niceMax = step * nIntervals;
  const values = [];
  for (let i = 0; i <= nIntervals; i++) values.push(i * step);
  return { niceMax, values };
}

// Formato compacto para las etiquetas del eje Y (20k, 2.5k, 0…).
function compactNum(v) {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1) + 'k';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Línea/área interactiva: al pasar el mouse por un punto lo resalta, traza una
// guía vertical y muestra un tooltip con la etiqueta y el valor exacto.
// Incluye grid + etiquetas del eje Y (niceAxis) para que se lea igual que un
// gráfico "de verdad" en vez de una silueta sin escala.
export function LineChartInteractive({ vals = [], labels = [], format }) {
  const [hover, setHover] = useState(null);
  const path = useMemo(() => {
    const w = 600, h = 220, padL = 40, padR = 12, padT = 12, padB = 28;
    if (vals.length < 2) return { empty: true, w, h };
    const rawMax = Math.max(...vals, 0);
    const { niceMax, values: yValues } = niceAxis(rawMax, 4);
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const step = innerW / (vals.length - 1);
    const pts = vals.map((v, i) => [padL + i * step, h - padB - (v / niceMax) * innerH]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ` L${pts[pts.length - 1][0].toFixed(1)} ${h - padB} L${padL} ${h - padB} Z`;
    const yTicks = yValues.map((v) => ({ v, y: h - padB - (v / niceMax) * innerH }));
    return { d, area, pts, w, h, padL, padR, padT, padB, step, yTicks };
  }, [vals]);
  if (path.empty) return <svg viewBox={`0 0 ${path.w} ${path.h}`} width="100%" height={path.h} />;
  const { d, area, pts, w, h, padL, padR, padT, padB, step, yTicks } = path;
  const hv = hover != null ? { x: pts[hover][0], y: pts[hover][1], val: vals[hover], lab: labels[hover] } : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={t.y.toFixed(1)} x2={(w - padR).toFixed(1)} y2={t.y.toFixed(1)}
              stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '3 5'} opacity={i === 0 ? 1 : 0.6} />
            <text x={padL - 6} y={(t.y + 3).toFixed(1)} fontSize="9" fill="var(--muted)" textAnchor="end" fontFamily="Inter">{compactNum(t.v)}</text>
          </g>
        ))}
        <path d={area} fill="var(--brand)" opacity=".12" />
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
        {hv && <line x1={hv.x.toFixed(1)} y1={padT} x2={hv.x.toFixed(1)} y2={(h - padB).toFixed(1)} stroke="var(--line)" strokeDasharray="3 3" />}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={hover === i ? 4.5 : 2.5} fill="var(--brand)" style={{ transition: 'r .1s' }} />
            <rect x={(p[0] - step / 2).toFixed(1)} y={padT} width={step.toFixed(1)} height={(h - padT - padB).toFixed(1)} fill="transparent"
              style={{ cursor: 'pointer' }} onMouseEnter={() => setHover(i)} />
          </g>
        ))}
        {labels.map((l, i) => <text key={i} x={(padL + i * step).toFixed(1)} y={h - 8} fontSize="9.5" fill="var(--muted)" textAnchor="middle" fontFamily="Inter">{l}</text>)}
      </svg>
      {hv && (
        <div className="line-tip" style={{ left: `${(hv.x / w) * 100}%`, top: `${(hv.y / h) * 100}%` }}>
          <b>{hv.lab}</b>
          <span>{format ? format(hv.val) : hv.val}</span>
        </div>
      )}
    </div>
  );
}

// Lista rankeada con barra de proporción (p. ej. "top planes" por recaudación).
export function RankList({ data = [], onSeeAll, seeAllLabel }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  return (
    <div>
      <div className="rank-list">
        {data.map((d, i) => (
          <div className="rank-row" key={i}>
            <div className="rk-lbl">
              <div className="rk-name">{d.label}</div>
              <div className="rk-bar"><i style={{ width: `${(d.value / max) * 100}%`, background: d.color || 'var(--brand)' }} /></div>
            </div>
            <div className="rk-val">{d.disp}</div>
          </div>
        ))}
      </div>
      {onSeeAll && (
        <div style={{ textAlign: 'right', marginTop: 10 }}>
          <span className="note link-action" onClick={onSeeAll}>
            {seeAllLabel} <span className="arw">→</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Embudo como lista de escalones: etiqueta y valor SIEMPRE van arriba de la
// barra (nunca encima ni dentro de ella), así el texto nunca se sale ni queda
// ilegible en escalones angostos. El % respecto del primer paso se muestra
// junto al valor, y al pasar el mouse la fila se resalta.
export function Funnel({ data = [], format }) {
  const [hover, setHover] = useState(null);
  const max = data[0]?.value || 1;
  return (
    <div className="funnel-list">
      {data.map((d, i) => {
        const pct = max ? (d.value / max) * 100 : 0;
        const active = hover === i;
        return (
          <div
            key={i}
            className={`funnel-row ${active ? 'act' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="fr-top">
              <span className="fr-name">{i + 1}. {d.label}</span>
              <span className="fr-val">
                <b>{format ? format(d.value) : d.value}</b>
                {i > 0 && <span className="fr-pct">{pct.toFixed(0)}%</span>}
              </span>
            </div>
            <div className="fr-track">
              <i style={{ width: `${Math.max(pct, 4)}%`, opacity: (1 - i * 0.22).toFixed(2) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Iconos de línea (reemplazan los emojis de acciones) ──
export function IconEdit({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconTrash({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
    </svg>
  );
}

export const COIN = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎', platinum: '⬡' };
export function IconUsers({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconWallet({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

export function IconGift({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" />
      <path d="M12 8v13" /><path d="M19 12v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8" />
      <path d="M16.5 8a2.5 2.5 0 0 0 0-5C14 3 12 8 12 8" />
    </svg>
  );
}

export function IconZap({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function IconCalendar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Iconos grandes de fondo para tarjetas KpiTrend "tint" (ver variant `tone`) ──
export function IconDownload({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconTrendingUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

export function IconStar({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ── Usuarios y soporte: mismos íconos de línea que las tarjetas KPI de arriba ──
export function IconCheckCircle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  );
}

export function IconBan({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
    </svg>
  );
}

export function IconTicket({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <line x1="10" y1="7" x2="10" y2="17" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

// ── Navegación y chrome (reemplazan los emojis del sidebar/topbar) ──
// Rellenos (fill=currentColor), no solo el contorno, para que se vean como
// íconos "sólidos" y no como líneas huecas — un único color (el que herede
// del contenedor), sin colores distintos por ítem.
export function IconDashboard({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <rect x="16" y="9" width="4" height="11" rx="1" />
    </svg>
  );
}

// Solo el símbolo "$", sin círculo detrás — pedido explícito del usuario.
export function IconDollarSign({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <text x="12" y="18.5" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="Arial, sans-serif">$</text>
    </svg>
  );
}

// Megáfono (difusión/promoción del sponsor) — el apretón de manos no se leía
// bien a tamaño chico en el sidebar.
export function IconMegaphone({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 10a2 2 0 0 1 2-2h2l10-4.5a1 1 0 0 1 1.4.9v15.2a1 1 0 0 1-1.4.9L6 16.5H4a2 2 0 0 1-2-2V10Z" />
      <path d="M6.5 17 8 21.5a1.2 1.2 0 0 0 1.14.8h.6A1.2 1.2 0 0 0 10.9 21l-.9-4H6.5Z" />
      <path d="M19.5 8.2c1.3 1 1.3 6.6 0 7.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconTool({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </svg>
  );
}

export function IconGraduationCap({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12.5v4.5c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5l-6 3-6-3Z" />
    </svg>
  );
}

export function IconBook({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z" />
    </svg>
  );
}

export function IconPuzzle({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.44 7.85c-.05.32.06.65.29.88l1.57 1.57c.94.94.94 2.47 0 3.41l-1.61 1.61a.98.98 0 0 1-.84.28c-.47-.07-.8-.48-.97-.93a2.5 2.5 0 1 0-3.21 3.21c.45.17.86.5.93.97a.98.98 0 0 1-.28.84l-1.61 1.61c-.94.94-2.47.94-3.41 0l-1.57-1.57a1.03 1.03 0 0 0-.88-.29c-.49.07-.84.5-1.02.97a2.5 2.5 0 1 1-3.24-3.24c.47-.18.9-.53.97-1.02a1.03 1.03 0 0 0-.29-.88L2.7 13.7c-.94-.94-.94-2.47 0-3.41l1.61-1.61c.23-.23.53-.34.84-.28.47.07.8.48.97.93a2.5 2.5 0 1 0 3.21-3.21c-.45-.17-.86-.5-.93-.97a.98.98 0 0 1 .28-.84L10.29 2.7c.94-.94 2.47-.94 3.41 0l1.57 1.57c.23.23.56.34.88.29.49-.07.84-.5 1.02-.97a2.5 2.5 0 1 1 3.24 3.24c-.47.18-.9.53-.97 1.02Z" />
    </svg>
  );
}

// Versión rellena de IconUsers específica para el nav del sidebar: IconUsers
// (línea, ya existente) se sigue usando en Users.jsx (tarjeta KPI), así que
// se deja intacta para no cambiar esa página; esta es una variante aparte.
export function IconUsersFilled({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 20.5C2 16.4 5.1 13 9 13s7 3.4 7 7.5V21H2v-.5Z" />
      <circle cx="17.5" cy="9" r="3" opacity=".7" />
      <path d="M16 13.3c3 .8 5.5 3.6 5.5 6.9v.8h-3.2v-.8c0-2.4-.9-4.5-2.3-6.9Z" opacity=".7" />
    </svg>
  );
}

export function IconClipboardList({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd">
      <path d="M8 2h8a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm1 7.2h6v1.6H9V9.2Zm0 4.4h6v1.6H9v-1.6Z" />
    </svg>
  );
}

export function IconMenu({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function IconGlobe({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  );
}

export function IconSun({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function IconMoon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export function IconLogOut({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// Insignia circular de color sólido con el ícono de línea "flotando" en blanco
// encima — el tratamiento "relleno + color" que reemplaza a los íconos de
// solo contorno en el sidebar. Cada vista tiene su propio color (v.color en
// App.jsx), así se distinguen de un vistazo en vez de verse todos iguales.
export function NavIcon({ icon: Icon, color, size = 26, iconSize = 14 }) {
  return (
    <span className="nav-ic-badge" style={{ background: color, width: size, height: size }}>
      <Icon size={iconSize} />
    </span>
  );
}

// Versión rellena (sólida) de los controles del topbar/login: a diferencia de
// los íconos de línea de arriba, estos usan fill en vez de stroke para que se
// vean "llenos" y cada uno lleva su propio color vía CSS (ver .ic-globe,
// .ic-sun, .ic-moon, .ic-logout en styles.css).
export function IconMenuFilled({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="5.5" width="18" height="3" rx="1.5" />
      <rect x="3" y="10.5" width="18" height="3" rx="1.5" />
      <rect x="3" y="15.5" width="18" height="3" rx="1.5" />
    </svg>
  );
}

export function IconGlobeFilled({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <g stroke="var(--panel)" strokeWidth="1.4" fill="none">
        <ellipse cx="12" cy="12" rx="4.2" ry="10" />
        <line x1="2.3" y1="12" x2="21.7" y2="12" />
        <path d="M3.6 7.5h16.8M3.6 16.5h16.8" />
      </g>
    </svg>
  );
}

export function IconSunFilled({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5.2" stroke="none" />
      <g>
        <line x1="12" y1="1.5" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22.5" />
        <line x1="4.2" y1="4.2" x2="5.9" y2="5.9" />
        <line x1="18.1" y1="18.1" x2="19.8" y2="19.8" />
        <line x1="1.5" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22.5" y2="12" />
        <line x1="4.2" y1="19.8" x2="5.9" y2="18.1" />
        <line x1="18.1" y1="5.9" x2="19.8" y2="4.2" />
      </g>
    </svg>
  );
}

export function IconMoonFilled({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export function IconLogOutFilled({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="currentColor" opacity=".9" stroke="none" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconEye({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconDiamond({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M2 9h20" />
      <path d="M9 3 7 9l5 12 5-12-2-6" />
    </svg>
  );
}

export function IconEyeOff({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a20.3 20.3 0 0 1-3.18 4.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Bandera para "recorrecciones" (reemplaza el emoji ⚑) — línea, en el mismo
// estilo que el resto de los íconos usados en tabs/EmptyState de esta consola.
export function IconFlag({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3v18" />
      <path d="M4 4.5c2-1.2 4-1.2 6 0s4 1.2 6 0c1-.6 2-.6 2 0v9c0 .6-1 .6-2 0-2-1.2-4-1.2-6 0s-4 1.2-6 0" />
    </svg>
  );
}

// Ícono de información (reemplaza el emoji ℹ️).
export function IconInfo({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Medalla para el conteo de badges de un alumno (reemplaza el emoji 🏅).
export function IconMedal({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" />
      <path d="m9 9.5-3-6M15 9.5l3-6" />
      <path d="M12 12.2v5.6M9.5 15h5" />
    </svg>
  );
}
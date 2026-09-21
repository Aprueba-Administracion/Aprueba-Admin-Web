import { useCallback, useEffect, useState, useMemo } from 'react';
import { api, qs } from '../api/client.js';
import { Card, Loading, ErrorBox, EmptyState, Select } from '../components/ui.jsx';

const ACTIONS = [
  'view', 'create', 'update', 'delete', 'restart',
  'confirmed', 'rejected', 'verify', 'unverify', 'pause', 'redeem', 'import',
];

export default function Audit({ ctx }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en';

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ action: '', resource: '' });
  const [resourceInput, setResourceInput] = useState('');

  // Control de historial y filtro por fecha
  const [expanded, setExpanded] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [appliedDate, setAppliedDate] = useState('');

  const load = useCallback(async (f) => {
    setErr(null);
    try {
      const r = await api.get(`/audit-log${qs(f)}`);
      setRows(r.data);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const id = setTimeout(() => setF('resource', resourceInput), 300);
    return () => clearTimeout(id);
  }, [resourceInput]);

  const fmtDate = (iso) => {
    if (!iso) return L('none');
    try { return new Date(iso).toLocaleString(ctx.lang === 'es' ? 'es-CL' : 'en-US'); }
    catch { return iso; }
  };

  const fmtDetail = (detail) => {
    if (detail == null) return L('none');

    let obj = detail;
    if (typeof detail === 'string') {
      try { obj = JSON.parse(detail); } catch { return detail; }
    }

    if (typeof obj === 'object' && obj !== null) {
      if ('range' in obj) {
        const labels = {
          '7d': isEn ? 'Last 7 days' : 'Últimos 7 días',
          '30d': isEn ? 'Last 30 days' : 'Últimos 30 días',
          '90d': isEn ? 'Last 90 days' : 'Últimos 90 días',
          '12m': isEn ? 'Last 12 months' : 'Últimos 12 meses',
        };
        const rLabel = labels[obj.range] || obj.range;
        return `${isEn ? 'Range' : 'Rango'}: ${rLabel}`;
      }

      const entries = Object.entries(obj);
      if (entries.length > 0) {
        return entries
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
          .join(' · ');
      }
    }

    return String(obj);
  };

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (!appliedDate) return rows;
    return rows.filter((r) => r.at && r.at.startsWith(appliedDate));
  }, [rows, appliedDate]);

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={() => load(filters)} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  const isFiltered = Boolean(filters.action || filters.resource);
  const latestAction = rows.length > 0 ? rows[0] : null;
  const nextThreeActions = rows.length > 1 ? rows.slice(1, 4) : [];

  return (
    <>
      <p className="sub au-sub">{L('au_intro')}</p>

      {/* ── FILTROS SUPERIORES ── */}
      <Card className="au-filter-card">
        <div className="flex between wrap au-head">
          <b>{L('au_table')}</b>
        </div>

        <div className="filters">
          <Select
            value={filters.action}
            onChange={(v) => setF('action', v)}
            options={ACTIONS.map((a) => ({ value: a, label: a }))}
            placeholder={`${L('au_filter_action')}: ${L('filter_all')}`}
          />
          <input
            value={resourceInput}
            onChange={(e) => setResourceInput(e.target.value)}
            placeholder={L('au_filter_resource')}
          />
          <button
            type="button"
            className="btn sec sm"
            onClick={() => {
              setResourceInput('');
              setFilters({ action: '', resource: '' });
              setDateFilter('');
              setAppliedDate('');
            }}
          >
            {L('clear_filters')}
          </button>
        </div>
      </Card>

      {/* ── TARJETAS: ÚLTIMA ACCIÓN Y SIGUIENTES ── */}
      {latestAction && (
        <div className="au-stack">
          {/* Tarjeta Enmarcada Principal */}
          <div className="au-hero-card">
            <div className="flex between au-hero-top">
              <div className="au-hero-left">
                <span className="au-badge-pill">
                  {isFiltered
                    ? (isEn ? 'Latest matching action' : 'Última acción coincidente con la búsqueda')
                    : (isEn ? 'Latest action' : 'Última acción realizada')}
                </span>
                <span className="note">{fmtDate(latestAction.at)}</span>
              </div>
              <span className="tag au-tag-brand">
                {latestAction.action}
              </span>
            </div>

            <div className="flex between wrap au-hero-body">
              <div>
                <b className="au-hero-actor">
                  {latestAction.actorName || latestAction.actorId || L('none')}
                </b>
                {latestAction.actorRole && (
                  <span className="note au-hero-role">({latestAction.actorRole})</span>
                )}
                <div className="au-hero-res">
                  {isEn ? 'Resource:' : 'Recurso:'} <code>{latestAction.resource}</code>
                </div>
              </div>

              <div className="au-detail-badge">
                <span className="ico">⚙️</span>
                <span>{fmtDetail(latestAction.detail)}</span>
              </div>
            </div>
          </div>

          {/* 3 Siguientes Acciones */}
          {nextThreeActions.length > 0 && (
            <div className="grid g3 au-sub-grid">
              {nextThreeActions.map((item, idx) => (
                <Card key={item.id || idx} className="au-sub-card">
                  <div>
                    <div className="flex between au-sub-card-top">
                      <span className="tag sm">{item.action}</span>
                      <span className="note">{fmtDate(item.at)}</span>
                    </div>
                    <b className="au-sub-actor">
                      {item.actorName || item.actorId || L('none')}
                    </b>
                    <span className="note">{item.resource}</span>
                  </div>
                  <div className="au-sub-detail">
                    {fmtDetail(item.detail)}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOTÓN DE ACCIÓN: DESPLEGAR TODO / OCULTAR ── */}
      <div className="au-toggle-wrap">
        <button
          type="button"
          className="btn sec au-btn-expand"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded
            ? (isEn ? '▲ Hide history' : '▲ Ocultar historial')
            : (isEn ? '▼ Show all' : '▼ Desplegar todo')}
        </button>
      </div>

      {/* ── HISTORIAL COMPLETO Y FILTRO POR FECHA ── */}
      {expanded && (
        <Card className="au-history-card">
          <div className="flex between wrap au-history-head">
            <b>{isEn ? 'Complete audit history' : 'Historial completo de auditoría'}</b>

            {/* Controles para filtrar por fecha */}
            <div className="flex wrap">
              <input
                type="date"
                className="au-date-input"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              <button
                type="button"
                className="btn sm"
                onClick={() => setAppliedDate(dateFilter)}
              >
                {isEn ? 'Filter by date' : 'Filtrar por fecha'}
              </button>
              {appliedDate && (
                <button
                  type="button"
                  className="btn sec sm"
                  onClick={() => { setDateFilter(''); setAppliedDate(''); }}
                >
                  {isEn ? 'Remove date filter' : 'Quitar fecha'}
                </button>
              )}
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <EmptyState
              msg={isEn ? 'No records found for the selected date' : 'No se encontraron registros para la fecha seleccionada'}
              ic="📅"
            />
          ) : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{L('au_date')}</th>
                    <th>{L('au_actor')}</th>
                    <th>{L('au_action')}</th>
                    <th>{L('au_resource')}</th>
                    <th>{L('au_detail')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((a, i) => (
                    <tr
                      key={a.id}
                      className={i === 0 && !appliedDate ? 'au-row-highlight' : undefined}
                    >
                      <td><span className="note">{fmtDate(a.at)}</span></td>
                      <td>
                        <b>{a.actorName || a.actorId || L('none')}</b>
                        {a.actorRole && <div className="note">{a.actorRole}</div>}
                      </td>
                      <td><span className="tag">{a.action}</span></td>
                      <td><span className="note">{a.resource}</span></td>
                      <td>
                        <span className="au-table-detail">
                          {fmtDetail(a.detail)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {err && <ErrorBox msg={err} onRetry={() => load(filters)} L={L} />}
        </Card>
      )}
    </>
  );
}
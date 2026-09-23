import { useCallback, useEffect, useState, useMemo } from 'react';
import { api, qs } from '../api/client.js';
import { Card, Loading, ErrorBox, EmptyState, Select } from '../components/ui.jsx';

const ACTIONS = [
  'view', 'create', 'update', 'delete', 'restart',
  'confirmed', 'rejected', 'verify', 'unverify', 'pause', 'redeem', 'import',
];

// Diccionario de acciones
const ACTION_LABELS = {
  view: { es: 'Ver', en: 'View' },
  create: { es: 'Crear', en: 'Create' },
  update: { es: 'Actualizar', en: 'Update' },
  delete: { es: 'Eliminar', en: 'Delete' },
  restart: { es: 'Reiniciar', en: 'Restart' },
  confirmed: { es: 'Confirmado', en: 'Confirmed' },
  rejected: { es: 'Rechazado', en: 'Rejected' },
  verify: { es: 'Verificar', en: 'Verify' },
  unverify: { es: 'Desverificar', en: 'Unverify' },
  pause: { es: 'Pausar', en: 'Pause' },
  redeem: { es: 'Canjear', en: 'Redeem' },
  import: { es: 'Importar', en: 'Import' },
};

// Diccionario de roles
const ROLE_LABELS = {
  admin: { es: 'Administrador', en: 'Admin' },
  finance: { es: 'Finanzas', en: 'Finance' },
  ops: { es: 'Operaciones', en: 'Ops' },
  support: { es: 'Soporte', en: 'Support' },
  system: { es: 'Sistema', en: 'System' },
};

// Diccionario para claves técnicas de detalle
const KEY_LABELS = {
  count: { es: 'cantidad', en: 'count' },
  total: { es: 'total', en: 'total' },
  status: { es: 'estado', en: 'status' },
  reason: { es: 'motivo', en: 'reason' },
  range: { es: 'rango', en: 'range' },
};

export default function Audit({ ctx }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en';
  const langKey = isEn ? 'en' : 'es';

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ action: '', resource: '', role: '' });
  const [resourceInput, setResourceInput] = useState('');

  const [expanded, setExpanded] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [appliedDate, setAppliedDate] = useState('');

  const fmtAction = useCallback((act) => {
    return ACTION_LABELS[act]?.[langKey] || act;
  }, [langKey]);

  const fmtRole = useCallback((role) => {
    if (!role) return '';
    return ROLE_LABELS[role.toLowerCase()]?.[langKey] || role;
  }, [langKey]);

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(ctx.lang === 'es' ? 'es-CL' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  }, [ctx.lang]);

  const fmtDetail = useCallback((detail) => {
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
          .map(([k, v]) => {
            const translatedKey = KEY_LABELS[k]?.[langKey] || k;
            const val = typeof v === 'object' ? JSON.stringify(v) : v;
            return `${translatedKey}: ${val}`;
          })
          .join(' · ');
      }
    }

    return String(obj);
  }, [L, isEn, langKey]);

  const load = useCallback(async (f) => {
    setErr(null);
    try {
      const r = await api.get(`/audit-log${qs(f)}`);
      const mapped = (r.data || []).map((row) => ({
        ...row,
        actionLabel: fmtAction(row.action),
        roleLabel: fmtRole(row.actorRole),
        formattedDate: row.at ? dateFormatter.format(new Date(row.at)) : L('none'),
        formattedDetail: fmtDetail(row.detail),
      }));
      setRows(mapped);
    } catch (e) { setErr(e.message); }
  }, [dateFormatter, fmtAction, fmtRole, fmtDetail, L]);

  useEffect(() => { load(filters); }, [filters, load]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const id = setTimeout(() => setF('resource', resourceInput), 300);
    return () => clearTimeout(id);
  }, [resourceInput]);

  const processedRows = useMemo(() => {
    if (!rows) return [];
    let list = rows;

    if (filters.role) {
      list = list.filter((r) => (r.actorRole || '').toLowerCase() === filters.role.toLowerCase());
    }

    if (appliedDate) {
      list = list.filter((r) => r.at && r.at.startsWith(appliedDate));
    }

    return list;
  }, [rows, filters.role, appliedDate]);

  const roleOptions = useMemo(() => [
    { value: 'admin', label: isEn ? 'Admin' : 'Administrador' },
    { value: 'finance', label: isEn ? 'Finance' : 'Finanzas' },
    { value: 'ops', label: isEn ? 'Ops' : 'Operaciones' },
    { value: 'support', label: isEn ? 'Support' : 'Soporte' },
    { value: 'system', label: isEn ? 'System' : 'Sistema' },
  ], [isEn]);

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={() => load(filters)} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  const isFiltered = Boolean(filters.action || filters.resource || filters.role || appliedDate);
  const latestAction = processedRows.length > 0 ? processedRows[0] : null;
  const nextThreeActions = processedRows.length > 1 ? processedRows.slice(1, 4) : [];

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
            options={ACTIONS.map((a) => ({ value: a, label: fmtAction(a) }))}
            placeholder={`${L('au_filter_action')}: ${L('filter_all')}`}
          />

          <Select
            value={filters.role}
            onChange={(v) => setF('role', v)}
            options={roleOptions}
            placeholder={isEn ? 'Filter by role: All' : 'Filtrar por rol: Todos'}
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
              setFilters({ action: '', resource: '', role: '' });
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
          {/* Tarjeta Principal Destacada */}
          <div className="au-hero-card">
            <div className="flex between au-hero-top">
              <div className="au-hero-left">
                <span className="au-badge-pill">
                  {isFiltered
                    ? (isEn ? 'Latest matching action' : 'Última acción coincidente con la búsqueda')
                    : (isEn ? 'Latest action' : 'Última acción realizada')}
                </span>
                <span className="note">{latestAction.formattedDate}</span>
              </div>
              <span className="tag au-tag-brand">
                {latestAction.actionLabel}
              </span>
            </div>

            <div className="flex between wrap au-hero-body">
              <div>
                <b className="au-hero-actor">
                  {latestAction.actorName || latestAction.actorId || L('none')}
                </b>
                {latestAction.roleLabel && (
                  <span className="note au-hero-role">({latestAction.roleLabel})</span>
                )}
                <div className="au-hero-res">
                  {isEn ? 'Resource:' : 'Recurso:'} <code>{latestAction.resource}</code>
                </div>
              </div>

              <div className="au-detail-badge">
                <span className="ico">⚙️</span>
                <span>{latestAction.formattedDetail}</span>
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
                      <span className="tag sm">{item.actionLabel}</span>
                      <span className="note">{item.formattedDate}</span>
                    </div>
                    <b className="au-sub-actor">
                      {item.actorName || item.actorId || L('none')}
                    </b>
                    <span className="note">{item.resource}</span>
                  </div>
                  <div className="au-sub-detail">
                    {item.formattedDetail}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOTÓN DE ACCIÓN ── */}
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

      {/* ── HISTORIAL COMPLETO ── */}
      {expanded && (
        <Card className="au-history-card">
          <div className="flex between wrap au-history-head">
            <b>{isEn ? 'Complete audit history' : 'Historial completo de auditoría'}</b>

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

          {processedRows.length === 0 ? (
            <EmptyState
              msg={isEn ? 'No records found' : 'No se encontraron registros con los filtros seleccionados'}
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
                  {processedRows.map((a, i) => (
                    <tr
                      key={a.id}
                      className={i === 0 && !appliedDate ? 'au-row-highlight' : undefined}
                    >
                      <td><span className="note">{a.formattedDate}</span></td>
                      <td>
                        <b>{a.actorName || a.actorId || L('none')}</b>
                        {a.roleLabel && <div className="note">{a.roleLabel}</div>}
                      </td>
                      <td><span className="tag">{a.actionLabel}</span></td>
                      <td><span className="note">{a.resource}</span></td>
                      <td>
                        <span className="au-table-detail">
                          {a.formattedDetail}
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
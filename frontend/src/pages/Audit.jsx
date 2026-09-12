import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api/client.js';
import { Card, Loading, ErrorBox, EmptyState, Select } from '../components/ui.jsx';

// Acciones que ya quedan registradas en la bitácora (ver backend/src/lib/audit.js
// y sus llamadas en metrics.js, users.js, tickets.js, corrections.js, ops.js,
// tutors.js, sponsors.js, questions.js y plans.js).
const ACTIONS = [
  'view', 'create', 'update', 'delete', 'restart',
  'confirmed', 'rejected', 'verify', 'unverify', 'pause', 'redeem', 'import',
];

export default function Audit({ ctx }) {
  const { L } = ctx;

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ action: '', resource: '' });

  const load = useCallback(async (f) => {
    setErr(null);
    try {
      const r = await api.get(`/audit-log${qs(f)}`);
      setRows(r.data);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const fmtDate = (iso) => {
    if (!iso) return L('none');
    try { return new Date(iso).toLocaleString(ctx.lang === 'es' ? 'es-CL' : 'en-US'); }
    catch { return iso; }
  };

  const fmtDetail = (detail) => {
    if (detail == null) return L('none');
    if (typeof detail === 'string') return detail;
    try { return JSON.stringify(detail); } catch { return String(detail); }
  };

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={() => load(filters)} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>{L('au_intro')}</p>

      <Card>
        <div className="flex between wrap" style={{ gap: 10, marginBottom: 12 }}>
          <b>{L('au_table')}</b>
        </div>

        <div className="filters" style={{ marginBottom: 12 }}>
          <Select value={filters.action} onChange={(v) => setF('action', v)}
            options={ACTIONS.map((a) => ({ value: a, label: a }))}
            placeholder={`${L('au_filter_action')}: ${L('filter_all')}`} />
          <input value={filters.resource} onChange={(e) => setF('resource', e.target.value)}
            placeholder={L('au_filter_resource')} />
          <button className="btn sec sm" onClick={() => setFilters({ action: '', resource: '' })}>{L('clear_filters')}</button>
        </div>

        {rows.length === 0 ? <EmptyState msg={L('au_no_rows')} ic="🧾" /> : (
          <div className="tbl-wrap"><table>
            <thead><tr>
              <th>{L('au_date')}</th><th>{L('au_actor')}</th><th>{L('au_action')}</th>
              <th>{L('au_resource')}</th><th>{L('au_detail')}</th>
            </tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id}>
                <td><span className="note">{fmtDate(a.at)}</span></td>
                <td>
                  <b>{a.actorName || a.actorId || L('none')}</b>
                  {a.actorRole && <div className="note">{a.actorRole}</div>}
                </td>
                <td><span className="tag">{a.action}</span></td>
                <td><span className="note">{a.resource}</span></td>
                <td><span className="note clamp">{fmtDetail(a.detail)}</span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {err && <ErrorBox msg={err} onRetry={() => load(filters)} L={L} />}
      </Card>
    </>
  );
}

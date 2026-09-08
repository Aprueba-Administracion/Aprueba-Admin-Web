import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import {
  Kpi, Card, StatusPill, Loading, HBars, ErrorBox, EmptyState, Modal, Confirm,
  Field, FormGrid, Select, Toast, useToast,
} from '../components/ui.jsx';

const TIERS = ['Bronze', 'Silver', 'Gold'];
const STATUSES = ['ok', 'deg', 'down'];

export default function Sponsors({ ctx }) {
  const { L, fmt } = ctx;
  const t = useToast();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr(null);
    try { setRows((await api.get('/sponsors')).data); } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      setDialog(null);
      if (okMsg) t.ok(okMsg);
      await load();
    } catch (e) { t.err(e.message); } finally { setBusy(false); }
  };

  const saveBasics = (form, sponsor) => {
    if (!form.name.trim()) { t.err(L('required_field')); return; }
    if (sponsor) {
      run(() => api.patch(`/sponsors/${sponsor.id}`, {
        name: form.name.trim(), tier: form.tier, monthlyFee: Number(form.monthlyFee || 0), status: form.status,
      }), L('saved_ok'));
    } else {
      run(() => api.post('/sponsors', {
        name: form.name.trim(), tier: form.tier, monthlyFee: Number(form.monthlyFee || 0), benefits: [],
      }), L('created_ok'));
    }
  };

  const saveBenefits = (sponsor, benefits) => {
    run(() => api.put(`/sponsors/${sponsor.id}/benefits`, { benefits }), L('saved_ok'));
  };

  const redeem = (sponsor, benefit) => {
    run(() => api.post(`/sponsors/${sponsor.id}/benefits/${benefit.id}/redeem`, { cantidad: 1 }), L('saved_ok'));
  };

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  const totRev = rows.reduce((a, s) => a + (s.monthlyFee || 0), 0);
  const totRed = rows.reduce((a, s) => a + (s.benefitsRedeemed || 0), 0);

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>{L('s_intro')}</p>
      <div className="grid g3">
        <Kpi ic="🤝" label={L('k_sponsors')} value={fmt(rows.length)} />
        <Kpi ic="💰" label={L('k_sponsor_rev')} value={`$${fmt(totRev)}${L('mo')}`} />
        <Kpi ic="🎁" label={L('k_benefits')} value={fmt(totRed)} />
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card className="span2">
          <div className="flex between wrap" style={{ gap: 10, marginBottom: 8 }}>
            <b>{L('s_table')}</b>
            <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('s_add')}</button>
          </div>
          {rows.length === 0 ? <EmptyState msg={L('s_no_sponsors')} ic="🤝" /> : (
            <div className="tbl-wrap"><table>
              <thead><tr>
                <th>{L('sp_name')}</th><th>{L('sp_tier')}</th><th>{L('sp_monthly')}</th>
                <th>{L('sp_offered')}</th><th>{L('sp_redeemed')}</th><th>{L('sp_status')}</th><th />
              </tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td><span className="tag">{s.tier}</span></td>
                  <td>${fmt(s.monthlyFee)}</td>
                  <td>{fmt(s.benefitsOffered ?? 0)}</td>
                  <td>{fmt(s.benefitsRedeemed ?? 0)}</td>
                  <td><StatusPill state={s.status} L={L} /></td>
                  <td><div className="row-acts">
                    <button className="btn sec sm" onClick={() => setDialog({ kind: 'benefits', sponsor: s })}>{L('s_benefits')}</button>
                    <button className="btn sec sm" onClick={() => setDialog({ kind: 'form', sponsor: s })}>{L('edit')}</button>
                    <button className="btn dgr sm" onClick={() => setDialog({ kind: 'delete', sponsor: s })}>🗑</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {err && <ErrorBox msg={err} onRetry={load} L={L} />}
        </Card>

        {rows.length > 0 && (
          <Card className="span2">
            <b>{L('s_rev_chart')}</b>
            <HBars data={rows.map((s) => ({
              label: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
              value: s.monthlyFee, disp: `$${fmt(s.monthlyFee)}`,
            }))} />
          </Card>
        )}
      </div>

      {dialog?.kind === 'form' && (
        <SponsorForm sponsor={dialog.sponsor} ctx={ctx} busy={busy}
          onClose={() => setDialog(null)} onSave={saveBasics} />
      )}

      {dialog?.kind === 'benefits' && (
        <BenefitsPanel sponsor={dialog.sponsor} ctx={ctx} busy={busy}
          onClose={() => setDialog(null)} onSave={saveBenefits} onRedeem={redeem} />
      )}

      {dialog?.kind === 'delete' && (
        <Confirm danger title={L('s_delete_title')} message={L('s_delete_msg', { name: dialog.sponsor.name })}
          confirmLabel={L('del')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => run(() => api.del(`/sponsors/${dialog.sponsor.id}`), L('deleted_ok'))} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

// Alta/edición de datos básicos del sponsor (sin beneficios: eso vive en BenefitsPanel).
function SponsorForm({ sponsor, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const [f, setF] = useState(() => ({
    name: sponsor?.name || '', tier: sponsor?.tier || 'Bronze',
    monthlyFee: sponsor?.monthlyFee ?? '', status: sponsor?.status || 'ok',
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modal busy={busy} title={sponsor ? L('s_edit') : L('s_new')} subtitle={sponsor?.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(f, sponsor)} disabled={busy}>{busy ? '…' : (sponsor ? L('save') : L('create'))}</button>
      </>}>
      <FormGrid>
        <Field wide label={`${L('sp_name')} *`}><input value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
        <Field label={L('sp_tier')}>
          <Select value={f.tier} onChange={set('tier')} options={TIERS.map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label={`${L('sp_monthly')} (USD)`}>
          <input type="number" min="0" value={f.monthlyFee} onChange={(e) => set('monthlyFee')(e.target.value)} />
        </Field>
        {sponsor && (
          <Field label={L('sp_status')}>
            <Select value={f.status} onChange={set('status')} options={STATUSES.map((x) => ({ value: x, label: L(`st_${x}`) }))} />
          </Field>
        )}
      </FormGrid>
    </Modal>
  );
}

// Catálogo de beneficios de un sponsor: nombre, costo en platino, stock, y
// lo ya canjeado. Se guarda todo junto con "Guardar catálogo"; canjear un
// beneficio es una acción aparte (conciliación real, inmediata).
function BenefitsPanel({ sponsor, ctx, busy, onClose, onSave, onRedeem }) {
  const { L } = ctx;
  const [items, setItems] = useState(() => (sponsor.benefits || []).map((b) => ({ ...b })));

  const update = (i, k, v) => setItems((arr) => arr.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)));
  const remove = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const add = () => setItems((arr) => [...arr, { name: '', costPlatino: 0, stock: 0, redeemed: 0 }]);

  return (
    <Modal busy={busy} title={`${L('s_benefits')} — ${sponsor.name}`} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(sponsor, items)} disabled={busy}>{busy ? '…' : L('save')}</button>
      </>}>
      {items.length === 0 && <p className="sub">{L('s_no_sponsors')}</p>}
      {items.map((b, i) => (
        <div key={b.id || i} className="flex wrap" style={{ gap: 8, marginBottom: 10, alignItems: 'flex-end' }}>
          <Field label="Nombre"><input value={b.name} onChange={(e) => update(i, 'name', e.target.value)} /></Field>
          <Field label="Costo (platino)">
            <input type="number" min="0" value={b.costPlatino} onChange={(e) => update(i, 'costPlatino', e.target.value)} />
          </Field>
          <Field label="Stock">
            <input type="number" min="0" value={b.stock} onChange={(e) => update(i, 'stock', e.target.value)} />
          </Field>
          <Field label="Canjeados"><input value={b.redeemed || 0} disabled /></Field>
          {b.id && (
            <button className="btn sec sm" disabled={busy || b.stock <= 0} onClick={() => onRedeem(sponsor, b)}>
              Canjear 1
            </button>
          )}
          <button className="btn dgr sm" onClick={() => remove(i)}>🗑</button>
        </div>
      ))}
      <button className="btn sec sm" onClick={add}>+ Agregar beneficio</button>
    </Modal>
  );
}
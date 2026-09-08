import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client.js';
import {
  Card, Loading, ErrorBox, Modal, Confirm, Field, FormGrid, Toast, useToast,
} from '../components/ui.jsx';

export default function Plans({ ctx }) {
  const { L, lang } = ctx;
  const t = useToast();
  const [features, setFeatures] = useState([]);
  const [plans, setPlans] = useState(null);
  const [err, setErr] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const [overId, setOverId] = useState(null);

  const load = async () => {
    setErr(null);
    try {
      setFeatures((await api.get('/features')).data);
      setPlans((await api.get('/plans')).data);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const featName = (f) => (lang === 'en' ? f.name_en : f.name_es) || f.name_es;
  const featById = (id) => features.find((f) => f.id === id);

  // ── edición local (en memoria hasta guardar) ──
  const update = (id, mut) => setPlans((ps) => ps.map((p) => (p.id === id ? mut({ ...p }) : p)));
  const dropFeat = (pid) => {
    const fid = drag.current; setOverId(null); drag.current = null;
    if (!fid) return;
    update(pid, (p) => { if (!p.features.includes(fid)) p.features = [...p.features, fid]; return p; });
  };
  const removeFeat = (pid, fid) => update(pid, (p) => { p.features = p.features.filter((f) => f !== fid); return p; });
  const setLimit = (pid, key, val) => update(pid, (p) => { p.limits = { ...p.limits, [key]: Math.max(0, parseInt(val || 0, 10)) }; return p; });
  const setBadge = (pid, key, val) => update(pid, (p) => { p.badges = { ...(p.badges || {}), [key]: Math.max(0, parseInt(val || 0, 10)) }; return p; });

  const payload = (p) => ({
    name: p.name, price: Number(p.price || 0), color: p.color,
    features: p.features, limits: p.limits, badges: p.badges,
  });

  const save = async (p) => {
    try {
      await api.put(`/plans/${p.id}`, payload(p));
      setSavedId(p.id); setTimeout(() => setSavedId(null), 2000);
      return true;
    } catch (e) { t.err(e.message); return false; }
  };

  const saveAll = async () => {
    let allOk = true;
    for (const p of plans) if (!(await save(p))) allOk = false;
    if (allOk) { setSavedId('ALL'); setTimeout(() => setSavedId(null), 2000); }
  };

  const createPlan = async (form) => {
    if (!form.name.trim()) { t.err(L('required_field')); return; }
    setBusy(true);
    try {
      const r = await api.post('/plans', {
        name: form.name.trim(),
        price: Number(form.price || 0),
        color: form.color,
        features: [],
        limits: { qDay: 0, groups: 0, tests: 1 },
        badges: { login: 1, purchase: 0, correct: 1 },
      });
      setPlans((ps) => [...ps, r.data]);
      setDialog(null);
      t.ok(L('created_ok'));
    } catch (e) { t.err(e.message); } finally { setBusy(false); }
  };

  const editMeta = async (form, plan) => {
    if (!form.name.trim()) { t.err(L('required_field')); return; }
    setBusy(true);
    try {
      const next = { ...plan, name: form.name.trim(), price: Number(form.price || 0), color: form.color };
      const r = await api.put(`/plans/${plan.id}`, payload(next));
      setPlans((ps) => ps.map((p) => (p.id === plan.id ? r.data : p)));
      setDialog(null);
      t.ok(L('saved_ok'));
    } catch (e) { t.err(e.message); } finally { setBusy(false); }
  };

  // El API responde 409 PLAN_HAS_SUBSCRIPTIONS si el plan tiene suscriptores activos.
  const deletePlan = async (plan) => {
    setBusy(true);
    try {
      await api.del(`/plans/${plan.id}`);
      setPlans((ps) => ps.filter((p) => p.id !== plan.id));
      setDialog(null);
      t.ok(L('p_deleted'));
    } catch (e) {
      t.err(e.message);
      if (e.code !== 'PLAN_HAS_SUBSCRIPTIONS') setDialog(null);
    } finally { setBusy(false); }
  };

  if (err && !plans) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!plans) return <Loading L={L} />;

  return (
    <>
      <p className="sub" style={{ marginBottom: 6 }}>{L('p_intro')}</p>
      <div className="builder">
        <Card style={{ position: 'sticky', top: 78 }}>
          <b>{L('p_catalog')}</b><div className="note">{L('p_drag_hint')}</div>
          {features.map((f) => (
            <div key={f.id} className="feat" draggable onDragStart={() => { drag.current = f.id; }} onDragEnd={() => { drag.current = null; }}>
              <span className="fi">{f.ic}</span>{featName(f)}
            </div>
          ))}
        </Card>
        <div>
          <div className="flex between" style={{ marginBottom: 10 }}>
            <span className="note">{savedId === 'ALL' ? `✓ ${L('p_saved')}` : ''}</span>
            <div className="flex" style={{ gap: 8 }}>
              <button className="btn sec sm" onClick={() => setDialog({ kind: 'new' })}>{L('p_add_plan')}</button>
              <button className="btn sm" onClick={saveAll}>{L('p_save')}</button>
            </div>
          </div>
          <div className="plan-cols">
            {plans.map((p) => (
              <div key={p.id} className="plan-col">
                <div className="plan-head" style={{ borderTop: `4px solid ${p.color}`, borderRadius: '14px 14px 0 0' }}>
                  <div className="flex between" style={{ gap: 6 }}>
                    <div className="pname">{p.name}</div>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn sec icon" title={L('p_edit_meta')} onClick={() => setDialog({ kind: 'meta', plan: p })}>✏️</button>
                      <button className="btn dgr icon" title={L('p_delete')} onClick={() => setDialog({ kind: 'delete', plan: p })}>🗑</button>
                    </div>
                  </div>
                  <div className="pprice" style={{ color: p.color }}>{p.price === 0 ? L('free_price') : `$${p.price}${L('mo')}`}</div>
                  <div className="note">{p.id}</div>
                </div>
                <div className={`dropzone ${overId === p.id ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
                  onDragLeave={() => setOverId((o) => (o === p.id ? null : o))}
                  onDrop={(e) => { e.preventDefault(); dropFeat(p.id); }}>
                  {p.features.length === 0 ? <div className="empty-hint">{L('p_empty')}</div> : p.features.map((id) => {
                    const f = featById(id); if (!f) return null;
                    return <div key={id} className="pfeat"><span>{f.ic}</span>{featName(f)}<span className="x" onClick={() => removeFeat(p.id, id)}>✕</span></div>;
                  })}
                </div>
                <div className="limits">
                  <div className="section-label" style={{ margin: '0 0 2px' }}>{L('p_limits')}</div>
                  <div className="limit-row"><label>{L('lim_qday')}</label><input type="number" min="0" value={p.limits.qDay} onChange={(e) => setLimit(p.id, 'qDay', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('lim_groups')}</label><input type="number" min="0" value={p.limits.groups} onChange={(e) => setLimit(p.id, 'groups', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('lim_tests')}</label><input type="number" min="0" value={p.limits.tests} onChange={(e) => setLimit(p.id, 'tests', e.target.value)} /></div>
                  <div className="note" style={{ marginTop: 8 }}>0 = {L('unlimited')}</div>
                </div>
                {/* Badges por acción (campo `badges` del modelo de planes). */}
                <div className="limits">
                  <div className="section-label" style={{ margin: '0 0 2px' }}>🏅 {L('p_badges')}</div>
                  <div className="limit-row"><label>{L('bdg_login')}</label><input type="number" min="0" value={p.badges?.login ?? 0} onChange={(e) => setBadge(p.id, 'login', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('bdg_purchase')}</label><input type="number" min="0" value={p.badges?.purchase ?? 0} onChange={(e) => setBadge(p.id, 'purchase', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('bdg_correct')}</label><input type="number" min="0" value={p.badges?.correct ?? 0} onChange={(e) => setBadge(p.id, 'correct', e.target.value)} /></div>
                  <div className="note" style={{ marginTop: 8 }}>{L('badges_unit')} / {lang === 'es' ? 'acción' : 'action'}</div>
                </div>
                <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
                  <button className="btn sm" style={{ width: '100%' }} onClick={() => save(p)}>{savedId === p.id ? `✓ ${L('p_saved')}` : L('p_save')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dialog?.kind === 'new' && (
        <PlanMetaForm ctx={ctx} busy={busy} onClose={() => setDialog(null)} onSave={(f) => createPlan(f)} />
      )}
      {dialog?.kind === 'meta' && (
        <PlanMetaForm plan={dialog.plan} ctx={ctx} busy={busy} onClose={() => setDialog(null)}
          onSave={(f) => editMeta(f, dialog.plan)} />
      )}
      {dialog?.kind === 'delete' && (
        <Confirm danger title={L('p_delete_title')} message={L('p_delete_msg', { name: dialog.plan.name })}
          confirmLabel={L('del')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => deletePlan(dialog.plan)} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

function PlanMetaForm({ plan, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const [f, setF] = useState(() => ({
    name: plan?.name || '',
    price: plan?.price ?? 0,
    color: plan?.color || '#6366F1',
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modal busy={busy} title={plan ? L('p_edit_meta') : L('p_add_plan')} subtitle={plan?.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(f)} disabled={busy}>{busy ? '…' : (plan ? L('save') : L('create'))}</button>
      </>}>
      <FormGrid>
        <Field wide label={`${L('p_name')} *`}><input value={f.name} onChange={(e) => set('name')(e.target.value)} /></Field>
        <Field label={L('p_price')}><input type="number" min="0" step="0.5" value={f.price} onChange={(e) => set('price')(e.target.value)} /></Field>
        <Field label={L('p_color')}>
          <div className="flex" style={{ gap: 8 }}>
            <input type="color" value={f.color} onChange={(e) => set('color')(e.target.value)} />
            <input value={f.color} className="mono" onChange={(e) => set('color')(e.target.value)} />
          </div>
        </Field>
      </FormGrid>
    </Modal>
  );
}

import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client.js';
import { planLabel, planMonthly } from './users/shared.jsx';
import {
  Card, Loading, ErrorBox, Modal, Confirm, Field, FormGrid, Toast, useToast, IconEdit, IconTrash,
} from '../components/ui.jsx';
import {
  FeatureIcon, PlanIcon, planIconKey, IconMore, IconX, IconCheck, IconMedal,
} from './plans/planIcons.jsx';

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
  const [menuId, setMenuId] = useState(null); // menú "…" abierto de un plan
  // Foto de lo último guardado de cada plan, para marcar los que tienen cambios sin guardar.
  const base = useRef({});
  const sig = (p) => JSON.stringify([p.name, planMonthly(p), p.color, p.features, p.limits, p.badges]);
  const isDirty = (p) => base.current[p.id] !== sig(p);
  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

  const load = async () => {
    setErr(null);
    try {
      setFeatures((await api.get('/features')).data);
      const ps = (await api.get('/plans')).data;
      base.current = Object.fromEntries(ps.map((x) => [x.id, sig(x)]));
      setPlans(ps);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  // Modelo canónico: f.name = { es, en }, f.icon. Tolera el formato anterior (name_es / name_en / ic).
  const featName = (f) => (f.name && typeof f.name === 'object' ? (f.name[lang] || f.name.es) : (lang === 'en' ? f.name_en : f.name_es) || f.name_es);
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

  // name {es,en}; el precio se manda como número = price.monthly (el anual lo gestiona la app).
  const payload = (p) => ({
    name: p.name, price: planMonthly(p), color: p.color,
    features: p.features, limits: p.limits, badges: p.badges,
    // Concurrencia optimista: si otra persona editó el plan, el API responde 409 PLAN_CONFLICT.
    updatedAt: p.updatedAt,
  });

  const save = async (p) => {
    try {
      const r = await api.put(`/plans/${p.id}`, payload(p));
      // Se toma el updatedAt nuevo para que el siguiente guardado no choque consigo mismo.
      base.current[p.id] = sig(p);
      setPlans((ps) => ps.map((x) => (x.id === p.id ? { ...x, updatedAt: r.data.updatedAt, updatedBy: r.data.updatedBy } : x)));
      setSavedId(p.id); setTimeout(() => setSavedId(null), 2000);
      return true;
    } catch (e) {
      t.err(e.message);
      if (e.code === 'PLAN_CONFLICT') load(); // recarga los planes con la versión vigente
      return false;
    }
  };

  const saveAll = async () => {
    let allOk = true;
    for (const p of plans) if (!(await save(p))) allOk = false;
    if (allOk) { setSavedId('ALL'); setTimeout(() => setSavedId(null), 2000); }
  };

  const createPlan = async (form) => {
    if (!form.nameEs.trim()) { t.err(L('required_field')); return; }
    setBusy(true);
    try {
      const r = await api.post('/plans', {
        name: { es: form.nameEs.trim(), en: (form.nameEn.trim() || form.nameEs.trim()) },
        price: Number(form.price || 0),
        color: form.color,
        features: [],
        limits: { qDay: 0, groups: 0, tests: 1 },
        badges: { login: 1, purchase: 0, correct: 1 },
      });
      base.current[r.data.id] = sig(r.data);
      setPlans((ps) => [...ps, r.data]);
      setDialog(null);
      t.ok(L('created_ok'));
    } catch (e) { t.err(e.message); } finally { setBusy(false); }
  };

  const editMeta = async (form, plan) => {
    if (!form.nameEs.trim()) { t.err(L('required_field')); return; }
    setBusy(true);
    try {
      const next = {
        ...plan,
        name: { es: form.nameEs.trim(), en: (form.nameEn.trim() || form.nameEs.trim()) },
        price: Number(form.price || 0), color: form.color,
      };
      const r = await api.put(`/plans/${plan.id}`, payload(next));
      // Se conservan las ediciones locales (funciones, límites) y se actualizan solo los datos del plan.
      base.current[plan.id] = sig({ ...plan, name: r.data.name, price: r.data.price, color: r.data.color });
      setPlans((ps) => ps.map((p) => (p.id === plan.id ? { ...p, name: r.data.name, price: r.data.price, color: r.data.color, updatedAt: r.data.updatedAt, updatedBy: r.data.updatedBy } : p)));
      setDialog(null);
      t.ok(L('saved_ok'));
    } catch (e) {
      t.err(e.message);
      if (e.code === 'PLAN_CONFLICT') { setDialog(null); load(); }
    } finally { setBusy(false); }
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
      <p className="sub plans-intro">{L('p_intro')}</p>
      <div className="builder">
        <Card className="feature-catalog" style={{ position: 'sticky', top: 78 }}>
          <div className="catalog-title"><b>{L('p_catalog')}</b><div className="note">{L('p_drag_hint')}</div></div>
          <div className="feature-list">
            {features.map((f) => (
              <div key={f.id} className="feat" draggable onDragStart={() => { drag.current = f.id; }} onDragEnd={() => { drag.current = null; }}>
                <FeatureIcon feature={f} />{featName(f)}
              </div>
            ))}
          </div>
        </Card>
        <div className="plans-workspace">
          <div className="flex between plans-toolbar">
            <span className="note plans-status">
              {savedId === 'ALL' && <span className="ok-txt"><IconCheck />{L('p_saved')}</span>}
              {savedId !== 'ALL' && plans.some(isDirty) && <span className="dirty-txt"><i className="dirty-dot" />{L('p_unsaved')}</span>}
            </span>
            <div className="flex" style={{ gap: 8 }}>
              <button className="btn sec sm" onClick={() => setDialog({ kind: 'new' })}>{L('p_add_plan')}</button>
              <button className="btn sm" onClick={saveAll}>{L('p_save')}</button>
            </div>
          </div>
          <div className="plan-cols">
            {plans.map((p) => (
              <div key={p.id} className="plan-col">
                <div className="plan-head" style={{ '--pc': p.color }}>
                  <div className="plan-head-top">
                    <span className="plan-icon" style={{ color: p.color }}><PlanIcon name={planIconKey(p, plans)} /></span>
                    <div className="plan-menu">
                      <button className="btn sec icon-only" aria-label={L('p_menu')} title={L('p_menu')}
                        onClick={(e) => { e.stopPropagation(); setMenuId(menuId === p.id ? null : p.id); }}>
                        <IconMore />
                      </button>
                      {menuId === p.id && (
                        <div className="plan-menu-pop" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setMenuId(null); setDialog({ kind: 'meta', plan: p }); }}><IconEdit />{L('p_edit_meta')}</button>
                          {!p.system && <button className="danger" onClick={() => { setMenuId(null); setDialog({ kind: 'delete', plan: p }); }}><IconTrash />{L('p_delete')}</button>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="plan-name-row"><div className="pname">{planLabel(p, lang)}</div></div>
                  <div className="plan-price-row">
                    <div className="pprice" style={{ color: p.color }}>{planMonthly(p) === 0 ? L('free_price') : `$${planMonthly(p)}`}</div>
                    {planMonthly(p) > 0 && <span className="plan-price-caption">{L('mo')}</span>}
                  </div>
                  <div className="note mono-id">{p.id}</div>
                </div>
                <div className={`dropzone ${overId === p.id ? 'over' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
                  onDragLeave={() => setOverId((o) => (o === p.id ? null : o))}
                  onDrop={(e) => { e.preventDefault(); dropFeat(p.id); }}>
                  {p.features.length === 0 ? <div className="empty-hint">{L('p_empty')}</div> : p.features.map((id) => {
                    const f = featById(id); if (!f) return null;
                    return (
                      <div key={id} className="pfeat">
                        <FeatureIcon feature={f} size={15} />{featName(f)}
                        <button type="button" className="x" aria-label={L('del')} onClick={() => removeFeat(p.id, id)}><IconX size={13} /></button>
                      </div>
                    );
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
                  <div className="section-label with-ico" style={{ margin: '0 0 2px' }}><IconMedal />{L('p_badges')}</div>
                  <div className="limit-row"><label>{L('bdg_login')}</label><input type="number" min="0" value={p.badges?.login ?? 0} onChange={(e) => setBadge(p.id, 'login', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('bdg_purchase')}</label><input type="number" min="0" value={p.badges?.purchase ?? 0} onChange={(e) => setBadge(p.id, 'purchase', e.target.value)} /></div>
                  <div className="limit-row"><label>{L('bdg_correct')}</label><input type="number" min="0" value={p.badges?.correct ?? 0} onChange={(e) => setBadge(p.id, 'correct', e.target.value)} /></div>
                  <div className="note" style={{ marginTop: 8 }}>{L('badges_unit')} / {lang === 'es' ? 'acción' : 'action'}</div>
                </div>
                <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
                  <button className={`btn sm ${isDirty(p) || savedId === p.id ? '' : 'sec'}`} style={{ width: '100%' }} onClick={() => save(p)}>
                    {savedId === p.id ? <><IconCheck />{L('p_saved')}</> : L('p_save')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dialog?.kind === 'new' && (
        <PlanMetaForm ctx={ctx} plans={plans} busy={busy} onClose={() => setDialog(null)} onSave={(f) => createPlan(f)} />
      )}
      {dialog?.kind === 'meta' && (
        <PlanMetaForm plan={dialog.plan} ctx={ctx} plans={plans} busy={busy} onClose={() => setDialog(null)}
          onSave={(f) => editMeta(f, dialog.plan)} />
      )}
      {dialog?.kind === 'delete' && (
        <Confirm danger title={L('p_delete_title')} message={L('p_delete_msg', { name: planLabel(dialog.plan, lang) })}
          confirmLabel={L('del')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => deletePlan(dialog.plan)} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

function PlanMetaForm({ plan, plans, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const [f, setF] = useState(() => ({
    nameEs: (plan?.name && typeof plan.name === 'object' ? plan.name.es : plan?.name) || '',
    nameEn: (plan?.name && typeof plan.name === 'object' ? plan.name.en : plan?.name) || '',
    price: plan ? planMonthly(plan) : 0,
    color: plan?.color || '#6366F1',
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  // Vista previa del ícono automático según el precio que se está escribiendo.
  const previewPlan = { id: plan?.id || '__new__', price: Number(f.price || 0) };
  const others = plans.filter((x) => x.id !== plan?.id);
  const iconName = planIconKey(previewPlan, [...others, previewPlan]);

  return (
    <Modal busy={busy} title={plan ? L('p_edit_meta') : L('p_add_plan')} subtitle={plan?.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => onSave(f)} disabled={busy}>{busy ? '…' : (plan ? L('save') : L('create'))}</button>
      </>}>
      <FormGrid>
        <Field label={`${L('p_name')} (ES) *`}><input value={f.nameEs} maxLength={60} onChange={(e) => set('nameEs')(e.target.value)} /></Field>
        <Field label={`${L('p_name')} (EN)`}><input value={f.nameEn} maxLength={60} onChange={(e) => set('nameEn')(e.target.value)} /></Field>
        <Field label={L('p_price')}><input type="number" min="0" step="0.5" value={f.price} onChange={(e) => set('price')(e.target.value)} /></Field>
        <Field label={L('p_color')}>
          <div className="flex" style={{ gap: 8 }}>
            <input type="color" value={f.color} onChange={(e) => set('color')(e.target.value)} />
            <input value={f.color} className="mono" onChange={(e) => set('color')(e.target.value)} />
          </div>
        </Field>
        <Field label={L('p_icon_auto')} hint={L('p_icon_hint')}>
          <span className="plan-icon" style={{ color: f.color }}><PlanIcon name={iconName} /></span>
        </Field>
      </FormGrid>
    </Modal>
  );
}

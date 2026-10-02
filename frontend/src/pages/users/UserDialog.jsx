import { useEffect, useState } from "react";

import { Card, Loading, Modal, Field, FormGrid, Select, KV, Pill, IconMedal } from "../../components/ui.jsx";
import { USER_STATES, STATE_TAG, initials } from "./shared.jsx";

export default function UserDialog({ user, loading, ctx, busy, planOptions, plansUnavailable, onClose, onSave }) {
  const { L, fmt } = ctx;
  const [pendingEmail, setPendingEmail] = useState(user.pendingEmail || '');
  const [plan, setPlan] = useState(user.plan || '');
  const [state, setState] = useState(user.state || 'active');
  const [reason, setReason] = useState('');

  useEffect(() => {
    setPendingEmail(user.pendingEmail || ''); setPlan(user.plan || ''); setState(user.state || 'active');
  }, [user]);

  const dirty = pendingEmail !== (user.pendingEmail || '') || plan !== (user.plan || '') || state !== (user.state || 'active');

  const submit = () => {
    const patch = {};
    if (pendingEmail !== (user.pendingEmail || '')) patch.pendingEmail = pendingEmail || null;
    if (plan !== (user.plan || '')) patch.plan = plan;
    if (state !== (user.state || 'active')) patch.state = state;
    if (reason.trim()) patch.reason = reason.trim();
    if (!Object.keys(patch).length) { onClose(); return; }
    onSave(patch);
  };

  const la = user.lastAdminAction;

  return (
    <Modal wide busy={busy} title={L('u_detail')} subtitle={user.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('close')}</button>
        <button className="btn" onClick={submit} disabled={busy || !dirty}>{busy ? '…' : L('save')}</button>
      </>}>
      {loading ? <Loading L={L} /> : (
        <>
          <div className="flex user-dialog-layout-1" >
            <div className="avatar md">{initials(user.name)}</div>
            <div>
              <b className="user-dialog-layout-2" >{user.name}</b>
              <div className="note">{user.email}</div>
            </div>
            <div className="user-dialog-layout-3" ><Pill value={user.state} map={STATE_TAG} L={L} /></div>
          </div>

          <div className="grid g2">
            <Card className="flat">
              <div className="section-label tight">{L('u_detail')}</div>
              <KV k={L('u_id')} v={user.id} />
              <KV k={L('u_country')} v={user.country} />
              <KV k={L('u_provider')} v={L(`provider_${user.authProvider}`)} />
              <KV k={L('u_plan_status')} v={L(`plan_status_${user.planStatus}`)} />
              <KV k={L('u_plan_source')} v={L(`plan_source_${user.planSource}`)} />
              <KV k={L('u_streak')} v={fmt(user.streak ?? 0)} />
              <KV k={L('u_badges')} v={
                <span className="user-dialog-layout-4" >
                  {fmt(user.badgesTotal ?? 0)} <IconMedal size={13} />
                </span>
              } />
              <KV k={L('u_last')} v={user.lastActiveLabel || L('none')} />
              <KV k={L('u_pending_email')} v={user.pendingEmail || L('none')} />
            </Card>
            <Card className="flat">
              <div className="section-label tight">{L('u_last_admin_action')}</div>
              {la ? (
                <>
                  <KV k={L('u_last_admin_action')} v={L(`admin_action_${la.action}`)} />
                  <KV k={L('u_admin_by')} v={la.by} />
                  <KV k={L('u_admin_reason')} v={la.reason || L('none')} />
                  <KV k={L('u_admin_when')} v={la.at ? new Date(la.at).toLocaleString() : L('none')} />
                </>
              ) : <p className="note">{L('none')}</p>}
            </Card>
          </div>

          <div className="section-label">{L('edit')}</div>
          <FormGrid>
            <Field label={L('u_pending_email')} hint={L('u_pending_email_ph')}>
              <input type="email" value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} />
            </Field>
            <Field label={L('u_plan')} hint={plansUnavailable ? L('u_plans_unavailable') : undefined}>
              <Select value={plan} onChange={setPlan} options={planOptions} placeholder={L('none')} />
            </Field>
            <Field label={L('u_state')}>
              <Select value={state} onChange={setState} options={USER_STATES.map((s) => ({ value: s, label: L(STATE_TAG[s][1]) }))} />
            </Field>
            <Field label={L('u_reason')} hint={L('u_reason_ph')}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </FormGrid>
        </>
      )}
    </Modal>
  );
}

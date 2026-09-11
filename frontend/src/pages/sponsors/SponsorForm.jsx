import { useState } from 'react';
import { Modal, FormGrid, Field, Select } from '../../components/ui.jsx';

const TIERS = ['Bronze', 'Silver', 'Gold'];
const STATUSES = ['ok', 'deg', 'down'];

export function SponsorForm({ sponsor, ctx, busy, onClose, onSave }) {
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
          <input
            type="number"
            min="0"
            value={f.monthlyFee}
            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            onChange={(e) => set('monthlyFee')(e.target.value)}
          />
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

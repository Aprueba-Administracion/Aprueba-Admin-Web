import { useState } from 'react';
import { Modal, FormGrid, Field } from '../../components/ui.jsx';

export function BenefitItemForm({ sponsor, benefit, index, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const isEditing = Boolean(benefit);

  const [form, setForm] = useState(() => ({
    name: benefit?.name || '',
    costPlatino: benefit?.costPlatino ?? '',
    stock: benefit?.stock ?? '',
    expiresAt: benefit?.expiresAt || '',
    noLimit: !benefit?.expiresAt,
  }));

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    onSave(sponsor, {
      name: form.name,
      costPlatino: Number(form.costPlatino || 0),
      stock: Number(form.stock || 0),
      expiresAt: form.noLimit ? null : (form.expiresAt || null),
    }, index);
  };

  const modalTitle = isEditing
    ? (isEn ? `Edit Benefit — ${sponsor.name}` : `Editar Beneficio — ${sponsor.name}`)
    : (isEn ? `New Benefit — ${sponsor.name}` : `Nuevo Beneficio — ${sponsor.name}`);

  return (
    <Modal
      busy={busy}
      title={modalTitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
          <button className="btn" onClick={handleSubmit} disabled={busy}>
            {busy ? '…' : L('save')}
          </button>
        </>
      }
    >
      <FormGrid>
        <Field wide label={`${isEn ? 'Benefit name' : 'Nombre del beneficio'} *`}>
          <input
            placeholder={isEn ? 'e.g. Free savings account' : 'Ej: Cuenta de ahorro sin costo'}
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        </Field>
        <Field label={isEn ? 'Cost (platinum)' : 'Costo (platino)'}>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.costPlatino}
            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            onChange={(e) => set('costPlatino')(e.target.value)}
          />
        </Field>
        <Field label={isEn ? 'Available stock' : 'Stock disponible'}>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.stock}
            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            onChange={(e) => set('stock')(e.target.value)}
          />
        </Field>
        <Field wide label={isEn ? 'Validity / Expiration' : 'Vigencia / Fecha límite'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  userSelect: 'none',
                  width: 'fit-content',
                }}
              >
                <input
                  type="checkbox"
                  style={{ margin: 0, cursor: 'pointer', width: 'auto' }}
                  checked={form.noLimit}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      noLimit: checked,
                      expiresAt: checked ? '' : prev.expiresAt,
                    }));
                  }}
                />
                <span>{isEn ? 'Unlimited (no expiration date)' : 'Sin límite de vigencia'}</span>
              </label>
            </div>

            {!form.noLimit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 300 }}>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set('expiresAt')(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 6 }}
                />
                {form.expiresAt && (
                  <button
                    type="button"
                    className="btn sec sm"
                    onClick={() => set('expiresAt')('')}
                    title={isEn ? 'Clear date' : 'Borrar fecha'}
                    style={{ padding: '6px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    ✕ {isEn ? 'Clear' : 'Borrar'}
                  </button>
                )}
              </div>
            )}
          </div>
        </Field>
      </FormGrid>
    </Modal>
  );
}

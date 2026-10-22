import { useState } from 'react';
import { Modal, FormGrid, Field } from '../../components/ui.jsx';

export function BenefitItemForm({ sponsor, benefit, index, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const isEditing = Boolean(benefit);

  const [form, setForm] = useState(() => ({
    name: benefit?.name || '',
    description: benefit?.description || '',
    icon: benefit?.icon || '',
    costPlatinum: benefit?.costPlatinum ?? '',
    stock: benefit?.stock ?? '',
    expiresAt: benefit?.expiresAt || '',
    noLimit: !benefit?.expiresAt,
  }));

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    onSave(sponsor, {
      name: form.name,
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      costPlatinum: Number(form.costPlatinum || 0),
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
        <Field wide label={isEn ? 'Description' : 'Descripción'}
          hint={`${form.description.length}/500`}>
          <textarea rows={3} maxLength={500} value={form.description}
            placeholder={isEn ? 'What the student gets (optional)' : 'Qué recibe el alumno (opcional)'}
            onChange={(e) => set('description')(e.target.value)} />
        </Field>
        <Field label={isEn ? 'Icon' : 'Ícono'} hint={isEn ? 'Emoji shown in the student app (optional).' : 'Emoji que ve el alumno en la app (opcional).'}>
          <input maxLength={8} value={form.icon} placeholder="🎁" onChange={(e) => set('icon')(e.target.value)} />
        </Field>
        <Field label={isEn ? 'Cost (platinum)' : 'Costo (platino)'}>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.costPlatinum}
            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
            onChange={(e) => set('costPlatinum')(e.target.value)}
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
          <div className="benefit-item-form-layout-1" >
            <div className="benefit-item-form-layout-2" >
              <label className="benefit-item-form-layout-3"
                
              >
                <input className="benefit-item-form-layout-4"
                  type="checkbox"
                  
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
              <div className="benefit-item-form-layout-5" >
                <input className="benefit-item-form-layout-6"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set('expiresAt')(e.target.value)}
                  
                />
                {form.expiresAt && (
                  <button
                    type="button"
                    className="btn sec sm benefit-item-form-layout-7"
                    onClick={() => set('expiresAt')('')}
                    title={isEn ? 'Clear date' : 'Borrar fecha'}
                    
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

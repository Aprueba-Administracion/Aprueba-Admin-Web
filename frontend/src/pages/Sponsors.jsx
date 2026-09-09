import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import {
  Kpi, Card, StatusPill, Loading, HBarsInteractive, DonutMulti, CAT_COLORS,
  ErrorBox, EmptyState, Modal, Confirm, Field, FormGrid, Select, Toast, useToast,
} from '../components/ui.jsx';

const TIERS = ['Bronze', 'Silver', 'Gold'];
const STATUSES = ['ok', 'deg', 'down'];

function TierBadge({ tier }) {
  const styles = {
    Gold: {
      background: 'rgba(234, 179, 8, 0.15)',
      color: '#d97706',
      border: '1px solid rgba(234, 179, 8, 0.35)',
    },
    Silver: {
      background: 'rgba(148, 163, 184, 0.15)',
      color: '#64748b',
      border: '1px solid rgba(148, 163, 184, 0.35)',
    },
    Bronze: {
      background: 'rgba(180, 83, 9, 0.15)',
      color: '#b45309',
      border: '1px solid rgba(180, 83, 9, 0.35)',
    },
  };

  const current = styles[tier] || styles.Bronze;

  return (
    <span
      className="tag"
      style={{
        ...current,
        fontWeight: 600,
        fontSize: '0.75rem',
        padding: '2px 8px',
        borderRadius: 9999,
      }}
    >
      {tier}
    </span>
  );
}

export default function Sponsors({ ctx }) {
  const { L, fmt } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const t = useToast();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const [activeTab, setActiveTab] = useState('sponsors');
  const [expandedSponsor, setExpandedSponsor] = useState(null);
  const [chartType, setChartType] = useState('bars');

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

  const saveSingleBenefit = (sponsor, benefitData, benefitIndex) => {
    if (!benefitData.name.trim()) { t.err(L('required_field')); return; }
    const currentBenefits = [...(sponsor.benefits || [])];

    if (benefitIndex !== undefined && benefitIndex !== null) {
      currentBenefits[benefitIndex] = { ...currentBenefits[benefitIndex], ...benefitData };
    } else {
      currentBenefits.push({ ...benefitData, redeemed: 0, id: `b_${Date.now()}` });
    }

    run(() => api.put(`/sponsors/${sponsor.id}/benefits`, { benefits: currentBenefits }), L('saved_ok'));
  };

  const deleteSingleBenefit = (sponsor, benefitIndex) => {
    const updated = (sponsor.benefits || []).filter((_, i) => i !== benefitIndex);
    run(() => api.put(`/sponsors/${sponsor.id}/benefits`, { benefits: updated }), L('deleted_ok'));
  };

  const redeem = (sponsor, benefit) => {
    run(() => api.post(`/sponsors/${sponsor.id}/benefits/${benefit.id}/redeem`, { cantidad: 1 }), L('saved_ok'));
  };

  const toggleAccordion = (id) => {
    setExpandedSponsor((prev) => (prev === id ? null : id));
  };

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={load} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  const totRev = rows.reduce((a, s) => a + (s.monthlyFee || 0), 0);
  const totRed = rows.reduce((a, s) => a + (s.benefitsRedeemed || 0), 0);
  const totBenefitsCount = rows.reduce((a, s) => a + ((s.benefits || []).length), 0);

  const chartData = [...rows]
    .sort((a, b) => (b.monthlyFee || 0) - (a.monthlyFee || 0))
    .map((s, i) => ({
      label: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
      value: s.monthlyFee || 0,
      disp: `$${fmt(s.monthlyFee)}`,
      color: CAT_COLORS[i % CAT_COLORS.length],
    }));

  return (
    <>
      <p className="sub" style={{ marginBottom: 14 }}>{L('s_intro')}</p>

      <div className="grid g3">
        <Kpi ic="🤝" label={L('k_sponsors')} value={fmt(rows.length)} />
        <Kpi ic="💰" label={L('k_sponsor_rev')} value={`$${fmt(totRev)}${L('mo')}`} />
        <Kpi ic="🎁" label={L('k_benefits')} value={fmt(totRed)} />
      </div>

      {/* Tabs superiores */}
      <div className="flex" style={{ gap: 8, marginTop: 20, marginBottom: -4 }}>
        <button
          className={`btn sm ${activeTab === 'sponsors' ? '' : 'sec'}`}
          style={{ borderRadius: 20, padding: '6px 16px', fontWeight: activeTab === 'sponsors' ? 600 : 400 }}
          onClick={() => setActiveTab('sponsors')}
        >
          🤝 {L('s_table') || (isEn ? 'Sponsor detail' : 'Detalle de sponsors')}
        </button>
        <button
          className={`btn sm ${activeTab === 'benefits' ? '' : 'sec'}`}
          style={{ borderRadius: 20, padding: '6px 16px', fontWeight: activeTab === 'benefits' ? 600 : 400 }}
          onClick={() => setActiveTab('benefits')}
        >
          🎁 {isEn ? 'Benefits' : 'Beneficios'} ({fmt(totBenefitsCount)})
        </button>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card className="span2">
          {activeTab === 'sponsors' ? (
            /* ================= TAB 1: SPONSORS ================= */
            <>
              <div className="flex between wrap" style={{ gap: 10, marginBottom: 12 }}>
                <b>{L('s_table') || (isEn ? 'Sponsor detail' : 'Detalle de sponsors')}</b>
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
                      <td><TierBadge tier={s.tier} /></td>
                      <td>${fmt(s.monthlyFee)}</td>
                      <td>{fmt(s.benefitsOffered ?? 0)}</td>
                      <td>{fmt(s.benefitsRedeemed ?? 0)}</td>
                      <td><StatusPill state={s.status} L={L} /></td>
                      <td>
                        <div className="row-acts" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, whiteSpace: 'nowrap' }}>
                          <button className="btn sec sm" onClick={() => setDialog({ kind: 'form', sponsor: s })} title={L('edit')}>
                            ✏️
                          </button>
                          <button className="btn dgr sm" onClick={() => setDialog({ kind: 'delete', sponsor: s })} title={L('del')}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </>
          ) : (
            /* ================= TAB 2: BENEFICIOS DESPLEGABLES ================= */
            <>
              <div className="flex between wrap" style={{ gap: 10, marginBottom: 16 }}>
                <b>{isEn ? 'Benefits by Sponsor' : 'Beneficios por Sponsor'}</b>
              </div>

              {rows.length === 0 ? (
                <EmptyState msg={L('s_no_sponsors')} ic="🤝" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rows.map((sponsor) => {
                    const isOpen = expandedSponsor === sponsor.id;
                    const benefits = sponsor.benefits || [];

                    return (
                      <div
                        key={sponsor.id}
                        style={{
                          border: '1px solid var(--border, rgba(148, 163, 184, 0.25))',
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: 'var(--card-bg, transparent)',
                        }}
                      >
                        {/* Cabecera del sponsor */}
                        <div
                          onClick={() => toggleAccordion(sponsor.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            backgroundColor: isOpen ? 'var(--hover-bg, rgba(255, 255, 255, 0.04))' : 'transparent',
                          }}
                        >
                          <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>{isOpen ? '▼' : '▶'}</span>
                            <span style={{ fontWeight: 600 }}>{sponsor.name}</span>
                            <TierBadge tier={sponsor.tier} />
                          </div>

                          <div className="flex" style={{ gap: 12, alignItems: 'center' }}>
                            <span className="sub" style={{ fontSize: '0.85rem' }}>
                              {fmt(benefits.length)} {benefits.length === 1 ? (isEn ? 'benefit' : 'beneficio') : (isEn ? 'benefits' : 'beneficios')}
                            </span>
                            <button
                              className="btn sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDialog({ kind: 'benefit_form', sponsor, benefit: null });
                              }}
                            >
                              + {isEn ? 'Add benefit' : 'Añadir beneficio'}
                            </button>
                          </div>
                        </div>

                        {/* Contenedor desplegable */}
                        {isOpen && (
                          <div
                            style={{
                              borderTop: '1px solid var(--border, rgba(148, 163, 184, 0.2))',
                              padding: '12px 16px',
                              backgroundColor: 'var(--sub-bg, rgba(0, 0, 0, 0.02))',
                            }}
                          >
                            {benefits.length === 0 ? (
                              <p className="sub" style={{ margin: '8px 0', fontSize: '0.88rem' }}>
                                {isEn ? 'No benefits registered.' : 'Sin beneficios cargados.'}
                              </p>
                            ) : (
                              <div className="tbl-wrap">
                                <table style={{ width: '100%', fontSize: '0.88rem' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left' }}>{isEn ? 'BENEFIT' : 'BENEFICIO'}</th>
                                      <th style={{ width: 130 }}>{isEn ? 'COST' : 'COSTO'}</th>
                                      <th style={{ width: 90 }}>{isEn ? 'STOCK' : 'STOCK'}</th>
                                      <th style={{ width: 90 }}>{isEn ? 'REDEEMED' : 'CANJEADOS'}</th>
                                      <th style={{ width: 150, textAlign: 'right' }}>{isEn ? 'ACTIONS' : 'ACCIONES'}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {benefits.map((b, idx) => (
                                      <tr key={b.id || idx}>
                                        <td><b>{b.name}</b></td>
                                        <td>💎 {fmt(b.costPlatino || 0)} {isEn ? 'platinum' : 'platino'}</td>
                                        <td>{fmt(b.stock || 0)} u.</td>
                                        <td>{fmt(b.redeemed || 0)}</td>
                                        <td>
                                          <div
                                            className="row-acts"
                                            style={{
                                              display: 'flex',
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              justifyContent: 'flex-end',
                                              gap: 6,
                                              flexWrap: 'nowrap',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            <button
                                              className="btn sec sm"
                                              disabled={busy || b.stock <= 0}
                                              onClick={() => redeem(sponsor, b)}
                                              title={isEn ? 'Redeem 1' : 'Canjear 1'}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                            >
                                              ⚡ 1
                                            </button>
                                            <button
                                              className="btn sec sm"
                                              onClick={() => setDialog({ kind: 'benefit_form', sponsor, benefit: b, index: idx })}
                                              title={L('edit') || (isEn ? 'Edit' : 'Editar')}
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              className="btn dgr sm"
                                              onClick={() => deleteSingleBenefit(sponsor, idx)}
                                              title={L('del') || (isEn ? 'Delete' : 'Eliminar')}
                                            >
                                              🗑
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {err && <ErrorBox msg={err} onRetry={load} L={L} />}
        </Card>

        {rows.length > 0 && activeTab === 'sponsors' && (
          <Card className="span2">
            <div className="flex between wrap" style={{ gap: 10, marginBottom: 4 }}>
              <b>{L('s_rev_chart')}</b>
              <div className="chart-toggle">
                <button className={`btn sm ${chartType === 'bars' ? '' : 'sec'}`} onClick={() => setChartType('bars')}>
                  {isEn ? 'Bars' : 'Barras'}
                </button>
                <button className={`btn sm ${chartType === 'donut' ? '' : 'sec'}`} onClick={() => setChartType('donut')}>
                  {isEn ? 'Circular' : 'Circular'}
                </button>
              </div>
            </div>
            {chartType === 'bars' ? (
              <HBarsInteractive data={chartData} />
            ) : (
              <DonutMulti data={chartData} centerLabel={`$${fmt(totRev)}`} />
            )}
          </Card>
        )}
      </div>

      {dialog?.kind === 'form' && (
        <SponsorForm sponsor={dialog.sponsor} ctx={ctx} busy={busy}
          onClose={() => setDialog(null)} onSave={saveBasics} />
      )}

      {dialog?.kind === 'benefit_form' && (
        <BenefitItemForm
          sponsor={dialog.sponsor}
          benefit={dialog.benefit}
          index={dialog.index}
          ctx={ctx}
          busy={busy}
          onClose={() => setDialog(null)}
          onSave={saveSingleBenefit}
        />
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

function SponsorForm({ sponsor, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
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

function BenefitItemForm({ sponsor, benefit, index, ctx, busy, onClose, onSave }) {
  const { L } = ctx;
  const isEn = ctx.lang === 'en' || (typeof L === 'function' && L('mo') === '/mo');
  const isEditing = Boolean(benefit);

  const [form, setForm] = useState(() => ({
    name: benefit?.name || '',
    costPlatino: benefit?.costPlatino ?? '',
    stock: benefit?.stock ?? 10,
  }));

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    onSave(sponsor, {
      name: form.name,
      costPlatino: Number(form.costPlatino || 0),
      stock: Number(form.stock || 0),
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
      </FormGrid>
    </Modal>
  );
}
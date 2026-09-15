import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import {
  Card, StatusPill, Loading, HBarsInteractive, DonutMulti, CAT_COLORS,
  ErrorBox, EmptyState, Confirm, Toast, useToast,
  IconEdit, IconTrash, IconUsers, IconWallet, IconGift, IconZap,
} from '../components/ui.jsx';

import { TierBadge } from './sponsors/TierBadge.jsx';
import { DateBadge, checkExpired } from './sponsors/DateBadge.jsx';
import { SponsorsBanner } from './sponsors/SponsorsBanner.jsx';
import { SponsorForm } from './sponsors/SponsorForm.jsx';
import { BenefitItemForm } from './sponsors/BenefitItemForm.jsx';

// ── Tarjeta KPI: fondo predominantemente blanco con degradado suave del color de
// la métrica (mismo espíritu que el banner de arriba) y un ícono gigante detrás,
// en vez de un color sólido. Los tonos y su ajuste en modo oscuro viven en
// styles.css (.kpi-tile / .kpi-tile.blue|green|purple) para que respeten el tema. ──
function SponsorKpiCard({ label, value, delta, up, icon: IconComponent, tone, isEn }) {
  return (
    <div className={`kpi-tile ${tone}`}>
      <div className="kpi-ic"><IconComponent size={115} /></div>

      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-val">{value}</div>
      </div>

      <div className={`kpi-delta ${delta && up ? 'up' : 'neutral'}`}>
        {delta ? <>{up ? '↑ ' : ''}{delta}</> : (isEn ? '— vs. prev. month' : '— vs. mes anterior')}
      </div>
    </div>
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
    if (checkExpired(benefit.expiresAt)) {
      t.err(isEn ? 'This benefit has expired' : 'Este beneficio ha expirado');
      return;
    }
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
      <div className="sp-layout" style={{ width: '100%' }}>

        {/* ================= COLUMNA IZQUIERDA ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Banner visual */}
          <SponsorsBanner
            title="Sponsors"
            subtitle={L('s_intro') || (isEn ? 'Brands funding student benefits.' : 'Marcas que financian beneficios para los alumnos.')}
          />

          {/* Tarjetas KPI sin icono pequeño superior */}
          <div className="grid g3" style={{ gap: 12 }}>
            <SponsorKpiCard
              label={L('k_sponsors')}
              value={fmt(rows.length)}
              delta={null}
              up={false}
              icon={IconUsers}
              tone="blue"
              isEn={isEn}
            />

            <SponsorKpiCard
              label={L('k_sponsor_rev')}
              value={`$${fmt(totRev)}${L('mo')}`}
              delta={`12% ${isEn ? 'vs. prev. month' : 'vs. mes anterior'}`}
              up={true}
              icon={IconWallet}
              tone="blue"
              isEn={isEn}
            />

            <SponsorKpiCard
              label={L('k_benefits')}
              value={fmt(totRed)}
              delta={null}
              up={false}
              icon={IconGift}
              tone="blue"
              isEn={isEn}
            />
          </div>

          {/* Selector de pestañas */}
          <div className="flex" style={{ gap: 8, marginTop: 4 }}>
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

          {/* Tabla de sponsors / Acordeón de beneficios */}
          <Card style={{ width: '100%' }}>
            {activeTab === 'sponsors' ? (
              <>
                <div className="flex between wrap" style={{ gap: 10, marginBottom: 12 }}>
                  <b>{L('s_table') || (isEn ? 'Sponsor detail' : 'Detalle de sponsors')}</b>
                  <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('s_add')}</button>
                </div>

                {rows.length === 0 ? <EmptyState msg={L('s_no_sponsors')} ic="🤝" /> : (
                  <div className="tbl-wrap" style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%' }}>
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
                                <IconEdit />
                              </button>
                              <button className="btn dgr sm" onClick={() => setDialog({ kind: 'delete', sponsor: s })} title={L('del')}>
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex between wrap" style={{ gap: 10, marginBottom: 16 }}>
                  <b>{isEn ? 'Benefits by Sponsor' : 'Beneficios por Sponsor'}</b>
                </div>

                {rows.length === 0 ? (
                  <EmptyState msg={L('s_no_sponsors')} ic="🤝" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
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
                            width: '100%',
                          }}
                        >
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
                                <div className="tbl-wrap" style={{ width: '100%', overflowX: 'auto' }}>
                                  <table style={{ width: '100%', fontSize: '0.88rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ textAlign: 'left' }}>{isEn ? 'BENEFIT' : 'BENEFICIO'}</th>
                                        <th style={{ width: 125 }}>{isEn ? 'COST' : 'COSTO'}</th>
                                        <th style={{ width: 85 }}>{isEn ? 'STOCK' : 'STOCK'}</th>
                                        <th style={{ width: 85 }}>{isEn ? 'REDEEMED' : 'CANJEADOS'}</th>
                                        <th style={{ width: 150 }}>{isEn ? 'EXPIRATION' : 'FECHA LÍMITE'}</th>
                                        <th style={{ width: 140, textAlign: 'right' }}>{isEn ? 'ACTIONS' : 'ACCIONES'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {benefits.map((b, idx) => {
                                        const isExpired = checkExpired(b.expiresAt);

                                        return (
                                          <tr key={b.id || idx} style={{ opacity: isExpired ? 0.65 : 1 }}>
                                            <td><b>{b.name}</b></td>
                                            <td>💎 {fmt(b.costPlatino || 0)} {isEn ? 'plat.' : 'plat.'}</td>
                                            <td>{fmt(b.stock || 0)} u.</td>
                                            <td>{fmt(b.redeemed || 0)}</td>
                                            <td>
                                              <DateBadge dateStr={b.expiresAt} isEn={isEn} />
                                            </td>
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
                                                  disabled={busy || b.stock <= 0 || isExpired}
                                                  onClick={() => redeem(sponsor, b)}
                                                  title={isExpired ? (isEn ? 'Expired benefit' : 'Beneficio expirado') : (isEn ? 'Redeem 1' : 'Canjear 1')}
                                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                >
                                                  <IconZap size={13} /> 1
                                                </button>
                                                <button
                                                  className="btn sec sm"
                                                  onClick={() => setDialog({ kind: 'benefit_form', sponsor, benefit: b, index: idx })}
                                                  title={L('edit') || (isEn ? 'Edit' : 'Editar')}
                                                >
                                                  <IconEdit />
                                                </button>
                                                <button
                                                  className="btn dgr sm"
                                                  onClick={() => deleteSingleBenefit(sponsor, idx)}
                                                  title={L('del') || (isEn ? 'Delete' : 'Eliminar')}
                                                >
                                                  <IconTrash />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
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
        </div>

        {/* ================= COLUMNA DERECHA ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>

          {/* Gráfico de Barras */}
          <Card>
            <b style={{ display: 'block', marginBottom: 12 }}>{L('s_rev_chart')}</b>
            <HBarsInteractive data={chartData} />
          </Card>

          {/* Gráfico Circular */}
          <Card>
            <b style={{ display: 'block', marginBottom: 12 }}>{isEn ? 'Distribution by sponsor' : 'Distribución por sponsor'}</b>
            <DonutMulti data={chartData} centerLabel={`$${fmt(totRev)}`} />
          </Card>

          {/* Mensaje motivacional */}
          <Card
            style={{
              position: 'relative',
              background: 'var(--quote-grad)',
              border: '1px solid var(--quote-border)',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--quote-icon-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                📣
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.45, fontWeight: 500, color: 'var(--quote-text)' }}>
                {isEn
                  ? 'Sponsors make it possible for more students to access great opportunities.'
                  : 'Los sponsors hacen posible que más estudiantes accedan a grandes oportunidades.'}
              </p>
            </div>
            <div style={{ position: 'absolute', right: 14, bottom: 6, fontSize: '1.8rem', opacity: 0.2, fontWeight: 700 }}>
              ”
            </div>
          </Card>
        </div>

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
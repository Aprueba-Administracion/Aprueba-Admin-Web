import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import {
  Card, StatusPill, Loading, HBarsInteractive, DonutMulti, CAT_COLORS,
  ErrorBox, EmptyState, Confirm, Toast, useToast,
  IconEdit, IconTrash, IconUsers, IconWallet, IconGift, IconZap, IconDiamond,
} from '../components/ui.jsx';

import { TierBadge } from './sponsors/TierBadge.jsx';
import { DateBadge, checkExpired } from './sponsors/DateBadge.jsx';
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
      currentBenefits.push({ ...benefitData, redeemedCount: 0, id: `b_${Date.now()}` });
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
      <div className="sp-layout sponsors-layout-1" >

        {/* ================= COLUMNA IZQUIERDA ================= */}
        <div className="sponsors-layout-2" >

          {/* Tarjetas KPI sin icono pequeño superior */}
          <div className="grid g3 sponsors-layout-3" >
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
          <div className="flex sponsors-layout-4" >
            <button
              className={(`btn sm ${activeTab === 'sponsors' ? '' : 'sec'}` || '') + ' sponsors-layout-5'}
              style={{ "--sponsors-layout-5-font-weight": activeTab === 'sponsors' ? 600 : 400 }}
              onClick={() => setActiveTab('sponsors')}
            >
              <IconUsers size={14} /> {L('s_table') || (isEn ? 'Sponsor detail' : 'Detalle de sponsors')}
            </button>
            <button
              className={(`btn sm ${activeTab === 'benefits' ? '' : 'sec'}` || '') + ' sponsors-layout-6'}
              style={{ "--sponsors-layout-6-font-weight": activeTab === 'benefits' ? 600 : 400 }}
              onClick={() => setActiveTab('benefits')}
            >
              <IconGift size={14} /> {isEn ? 'Benefits' : 'Beneficios'} ({fmt(totBenefitsCount)})
            </button>
          </div>

          {/* Tabla de sponsors / Acordeón de beneficios */}
          <Card className="sponsors-layout-7" >
            {activeTab === 'sponsors' ? (
              <div className="tab-fade" key="sponsors">
                <div className="flex between wrap sponsors-layout-8" >
                  <b>{L('s_table') || (isEn ? 'Sponsor detail' : 'Detalle de sponsors')}</b>
                  <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('s_add')}</button>
                </div>

                {rows.length === 0 ? <EmptyState msg={L('s_no_sponsors')} ic={<IconUsers size={22} />} /> : (
                  <div className="tbl-wrap sponsors-layout-9" >
                    <table className="sponsors-layout-10" >
                      <thead><tr>
                        <th>{L('sp_name')}</th><th>{L('sp_tier')}</th><th>{L('sp_monthly')}</th>
                        <th>{L('sp_offered')}</th><th>{L('sp_redeemed')}</th><th>{L('sp_status')}</th><th className="sponsors-layout-11"  />
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
                            <div className="row-acts sponsors-layout-12" >
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
              </div>
            ) : (
              <div className="tab-fade" key="benefits">
                <div className="flex between wrap sponsors-layout-13" >
                  <b>{isEn ? 'Benefits by Sponsor' : 'Beneficios por Sponsor'}</b>
                </div>

                {rows.length === 0 ? (
                  <EmptyState msg={L('s_no_sponsors')} ic={<IconGift size={22} />} />
                ) : (
                  <div className="sponsors-layout-14" >
                    {rows.map((sponsor) => {
                      const isOpen = expandedSponsor === sponsor.id;
                      const benefits = sponsor.benefits || [];

                      return (
                        <div className="sponsors-layout-15"
                          key={sponsor.id}
                          
                        >
                          <div className="sponsors-layout-16"
                            onClick={() => toggleAccordion(sponsor.id)}
                            style={{ "--sponsors-layout-16-background-color": ((value) => typeof value === 'number' ? value + 'px' : value)(isOpen ? 'var(--hover-bg, rgba(255, 255, 255, 0.04))' : 'transparent') }}
                          >
                            <div className="flex sponsors-layout-17" >
                              <span className="sponsors-layout-18" >{isOpen ? '▼' : '▶'}</span>
                              <span className="sponsors-layout-19" >{sponsor.name}</span>
                              <TierBadge tier={sponsor.tier} />
                            </div>

                            <div className="flex sponsors-layout-20" >
                              <span className="sub sponsors-layout-21" >
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
                            <div className="sponsors-layout-22"
                              
                            >
                              {benefits.length === 0 ? (
                                <p className="sub sponsors-layout-23" >
                                  {isEn ? 'No benefits registered.' : 'Sin beneficios cargados.'}
                                </p>
                              ) : (
                                <div className="tbl-wrap sponsors-layout-24" >
                                  <table className="sponsors-layout-25" >
                                    <thead>
                                      <tr>
                                        <th className="sponsors-layout-26" >{isEn ? 'BENEFIT' : 'BENEFICIO'}</th>
                                        <th className="sponsors-layout-27" >{isEn ? 'COST' : 'COSTO'}</th>
                                        <th className="sponsors-layout-28" >{isEn ? 'STOCK' : 'STOCK'}</th>
                                        <th className="sponsors-layout-29" >{isEn ? 'REDEEMED' : 'CANJEADOS'}</th>
                                        <th className="sponsors-layout-30" >{isEn ? 'EXPIRATION' : 'FECHA LÍMITE'}</th>
                                        <th className="sponsors-layout-31" >{isEn ? 'ACTIONS' : 'ACCIONES'}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {benefits.map((b, idx) => {
                                        const isExpired = checkExpired(b.expiresAt);

                                        return (
                                          <tr className="sponsors-layout-32" key={b.id || idx} style={{ "--sponsors-layout-32-opacity": isExpired ? 0.65 : 1 }}>
                                            <td><b>{b.name}</b></td>
                                            <td className="sponsors-layout-33" ><IconDiamond size={13} /> {fmt(b.costPlatinum || 0)} {isEn ? 'plat.' : 'plat.'}</td>
                                            <td>{fmt(b.stock || 0)} u.</td>
                                            <td>{fmt(b.redeemedCount || 0)}</td>
                                            <td>
                                              <DateBadge dateStr={b.expiresAt} isEn={isEn} />
                                            </td>
                                            <td>
                                              <div
                                                className="row-acts sponsors-layout-34"
                                                
                                              >
                                                <button
                                                  className="btn sec sm sponsors-layout-35"
                                                  disabled={busy || b.stock <= 0 || isExpired}
                                                  onClick={() => redeem(sponsor, b)}
                                                  title={isExpired ? (isEn ? 'Expired benefit' : 'Beneficio expirado') : (isEn ? 'Redeem 1' : 'Canjear 1')}
                                                  
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
              </div>
            )}

            {err && <ErrorBox msg={err} onRetry={load} L={L} />}
          </Card>
        </div>

        {/* ================= COLUMNA DERECHA ================= */}
        <div className="sponsors-layout-36" >

          {/* Gráfico de Barras */}
          <Card>
            <b className="sponsors-layout-37" >{L('s_rev_chart')}</b>
            <HBarsInteractive data={chartData} />
          </Card>

          {/* Gráfico Circular */}
          <Card>
            <b className="sponsors-layout-38" >{isEn ? 'Distribution by sponsor' : 'Distribución por sponsor'}</b>
            <div className="sponsors-layout-39" >
              <DonutMulti data={chartData} centerLabel={`$${fmt(totRev)}`} />
            </div>
          </Card>

          {/* Mensaje motivacional */}
          <Card className="sponsors-layout-40"
            
          >
            <div className="sponsors-layout-41" >
              <div className="sponsors-layout-42"
                
              >
                📣
              </div>
              <p className="sponsors-layout-43" >
                {isEn
                  ? 'Sponsors make it possible for more students to access great opportunities.'
                  : 'Los sponsors hacen posible que más estudiantes accedan a grandes oportunidades.'}
              </p>
            </div>
            <div className="sponsors-layout-44" >
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
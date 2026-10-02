import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  TopKpiCard, Card, Loading, ErrorBox, EmptyState, Modal, Confirm, Field, FormGrid, Select, Check,
  Chips, TagInput, Stars, Toast, useToast, KV, Pill, Tabs,
  IconGraduationCap, IconCheckCircle, IconVerifiedBadge, IconStar, IconUsers,
  IconEdit, IconTrash, IconX, IconPause, IconPlay,
  IconChevronLeft, IconMapPin, IconLanguages, IconDollarSign, IconCalendar, IconGlobe,
} from '../components/ui.jsx';

// Catálogos cerrados: coinciden con las constantes del backend (routes/tutors.js).
const MODES = ['online', 'in_person'];
const STATUSES = ['active', 'paused', 'rejected'];
const CRITERIA = ['teaching', 'punctuality', 'mastery'];
const STATUS_TAG = { active: ['g', 'ts_active'], paused: ['w', 'ts_paused'], rejected: ['d', 'ts_rejected'] };

const initialsOf = (name) => String(name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const numOr = (v, d = 0) => (v === '' || v == null || Number.isNaN(Number(v)) ? d : Number(v));

const emptyForm = () => ({
  name: '', initials: '', avatarColor: '#1A365D', textColor: '#FFFFFF',
  subjects: [], subjectsLabelEs: '', subjectsLabelEn: '',
  modes: ['online'], modesLabelEs: '', modesLabelEn: '',
  pricePerHour: '', currency: 'CLP', country: 'CL', languages: ['es'],
  bioEs: '', bioEn: '', yearsExperience: '',
  featured: false, verified: false, status: 'active',
  seedTeaching: '', seedPunctuality: '', seedMastery: '', reviewCountSeed: '',
  contactEmail: '', contactWhatsapp: '', contactSharingDefault: true,
});

const formFrom = (t) => ({
  ...emptyForm(),
  name: t.name || '',
  initials: t.initials || '',
  avatarColor: t.avatarColor || '#1A365D',
  textColor: t.textColor || '#FFFFFF',
  subjects: t.subjects || [],
  subjectsLabelEs: t.subjectsLabel?.es || '',
  subjectsLabelEn: t.subjectsLabel?.en || '',
  modes: t.modes || ['online'],
  modesLabelEs: t.modesLabel?.es || '',
  modesLabelEn: t.modesLabel?.en || '',
  pricePerHour: t.pricePerHour ?? '',
  currency: t.currency || 'CLP',
  country: t.country || 'CL',
  languages: t.languages || ['es'],
  bioEs: t.bio?.es || '',
  bioEn: t.bio?.en || '',
  yearsExperience: t.yearsExperience ?? '',
  featured: !!t.featured,
  verified: !!t.verified,
  status: t.status || 'active',
  seedTeaching: t.ratingSeed?.teaching ?? '',
  seedPunctuality: t.ratingSeed?.punctuality ?? '',
  seedMastery: t.ratingSeed?.mastery ?? '',
  reviewCountSeed: t.reviewCountSeed ?? '',
  contactEmail: t.contact?.email || '',
  contactWhatsapp: t.contact?.whatsapp || '',
  contactSharingDefault: t.contactSharingDefault !== false,
});

// Traduce el formulario al contrato del API. `verified` solo viaja en el alta:
// en la edición la verificación se gestiona con PATCH /tutors/:id/verification,
// que además registra quién y cuándo la concedió.
function toPayload(f, { isCreate }) {
  const modeLabel = (lang) => f.modes.map((m) => (lang === 'es'
    ? (m === 'online' ? 'Online' : 'Presencial')
    : (m === 'online' ? 'Online' : 'In-person'))).join(' · ');
  const seed = {
    teaching: numOr(f.seedTeaching),
    punctuality: numOr(f.seedPunctuality),
    mastery: numOr(f.seedMastery),
  };
  const hasSeed = CRITERIA.some((c) => seed[c]> 0);
  const payload = {
    name: f.name.trim(),
    initials: (f.initials || initialsOf(f.name) || 'TU').trim(),
    avatarColor: f.avatarColor,
    textColor: f.textColor,
    subjects: f.subjects,
    subjectsLabel: {
      es: f.subjectsLabelEs.trim() || f.subjects.join(' · '),
      en: f.subjectsLabelEn.trim() || f.subjects.join(' · '),
    },
    modes: f.modes,
    modesLabel: {
      es: f.modesLabelEs.trim() || modeLabel('es'),
      en: f.modesLabelEn.trim() || modeLabel('en'),
    },
    pricePerHour: numOr(f.pricePerHour),
    currency: f.currency.trim() || 'CLP',
    country: f.country.trim() || 'CL',
    languages: f.languages,
    bio: { es: f.bioEs, en: f.bioEn },
    yearsExperience: numOr(f.yearsExperience),
    featured: f.featured,
    // El backend valida los 3 criterios cuando ratingSeed no es null, así que se
    // envían siempre los tres o null.
    ratingSeed: hasSeed ? seed : null,
    reviewCountSeed: numOr(f.reviewCountSeed),
    contact: { email: f.contactEmail.trim(), whatsapp: f.contactWhatsapp.trim() },
    contactSharingDefault: f.contactSharingDefault,
    status: f.status,
  };
  if (isCreate) payload.verified = f.verified;
  return payload;
}

export default function Tutors({ ctx }) {
  const { L, lang, fmt } = ctx;
  const { isAdmin } = useAuth();
  const t = useToast();

  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [filters, setFilters] = useState({ status: '', subject: '', verified: '', q: '' });
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null); // {kind, tutor?, review?}
  const [busy, setBusy] = useState(false);
  const seenSubjects = useRef(new Set());
  // Antes la selección se guardaba por `id` del tutor. Si un registro (p.ej.
  // uno de prueba creado a medio llenar) tenía el id vacío o duplicado con
  // otro, `rows.find(x => x.id === selectedId)` podía resolver siempre al
  // mismo tutor sin importar en cuál se apretara "Ver" — daba la sensación de
  // que había que cerrar el panel para poder abrir otro. Usando la posición
  // en la lista en vez del id, el cambio de selección no depende de que los
  // ids vengan bien formados.
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [detailTab, setDetailTab] = useState('profile');
  const detailRequest = useRef(0);

  const load = useCallback(async (f = filters) => {
    setErr(null);
    try {
      const r = await api.get(`/tutors${qs(f)}`);
      setRows(r.data);
      r.data.forEach((x) => (x.subjects || []).forEach((s) => seenSubjects.current.add(s)));
    } catch (e) { setErr(e.message); }
  }, [filters]);

  useEffect(() => { load(filters); }, [filters, load]);
  // Debounce de la búsqueda por texto (el filtro `q` lo resuelve el backend).
  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(id);
  }, [search]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const clearFilters = () => { setSearch(''); setFilters({ status: '', subject: '', verified: '', q: '' }); };

  const subjectOptions = useMemo(
    () => [...seenSubjects.current].sort().map((s) => ({ value: s, label: s })),
    [rows],
  );

  const kpis = useMemo(() => {
    const list = rows || [];
    const rated = list.filter((x) => Number(x.rating)> 0);
    return {
      total: list.length,
      active: list.filter((x) => (x.status || 'active') === 'active').length,
      verified: list.filter((x) => x.verified).length,
      avg: rated.length ? (rated.reduce((s, x) => s + Number(x.rating), 0) / rated.length) : 0,
    };
  }, [rows]);

  // ── acciones ──
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      setDialog(null);
      if (okMsg) t.ok(okMsg);
      await load(filters);
    } catch (e) {
      t.err(e.message);
    } finally { setBusy(false); }
  };

  const saveTutor = (form, tutor) => {
    if (!form.name.trim()) { t.err(L('required_field')); return; }
    if (!form.subjects.length) { t.err(L('tu_err_subjects')); return; }
    const payload = toPayload(form, { isCreate: !tutor });
    run(
      () => (tutor ? api.put(`/tutors/${tutor.id}`, payload) : api.post('/tutors', payload)),
      tutor ? L('tu_updated') : L('tu_created'),
    );
  };

  const openDetail = (index) => {
    setSelectedIndex(index);
    setDetailTab('profile');
  };

  // Refresh the selected record after mutations, and discard stale responses.
  useEffect(() => {
    const request = ++detailRequest.current;
    const tutor = selectedIndex != null ? rows?.[selectedIndex] : null;
    if (!tutor) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    setDetail(tutor);
    setDetailLoading(true);
    setDetailError(null);
    api.get('/tutors/' + tutor.id).then((r) => {
      if (request === detailRequest.current) setDetail(r.data);
    }).catch((e) => {
      if (request === detailRequest.current) setDetailError(e.message);
    }).finally(() => {
      if (request === detailRequest.current) setDetailLoading(false);
    });
    return () => { detailRequest.current++; };
  }, [selectedIndex, rows]);

  // En teléfono la ficha se abre como ventana flotante encima de la lista
  // (ver tu-detail-backdrop más abajo); mientras está abierta se bloquea el
  // scroll del fondo para que se sienta como una ventana modal de verdad.
  useEffect(() => {
    if (!detail || typeof window === 'undefined') return;
    const isPhone = window.matchMedia('(max-width:620px)').matches;
    if (!isPhone) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [detail]);

  if (err && !rows) return <Card><ErrorBox msg={err} onRetry={() => load(filters)} L={L} /></Card>;
  if (!rows) return <Loading L={L} />;

  return (
    <div className="tu-page">
      <p className="sub tu-margin-bottom-14">{L('tu_intro')}</p>

      <div className="grid g4">
        <TopKpiCard icon={IconGraduationCap} tone="blue" label={L('tu_kpi_total')} value={fmt(kpis.total)} />
        <TopKpiCard icon={IconUsers} tone="blue" label={L('tu_kpi_active')} value={fmt(kpis.active)} />
        <TopKpiCard icon={IconCheckCircle} tone="blue" label={L('tu_kpi_verified')} value={fmt(kpis.verified)} />
        <TopKpiCard icon={IconStar} tone="blue" label={L('tu_kpi_avg')} value={kpis.avg ? kpis.avg.toFixed(1) : '—'} />
      </div>

      <Card className="tu-directory tu-margin-top-16">
        <div className="flex between wrap tu-gap-10 tu-margin-bottom-12">
          <b>{L('tu_table')}</b>
          <button className="btn sm" onClick={() => setDialog({ kind: 'form' })}>+ {L('tu_add')}</button>
        </div>

        <div className="filters tu-margin-bottom-12">
          <input className="grow" placeholder={L('tu_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={filters.status} onChange={(v) => setF('status', v)} placeholder={`${L('tu_status')}: ${L('filter_all')}`}
            options={STATUSES.map((s) => ({ value: s, label: L(STATUS_TAG[s][1]) }))} />
          <Select value={filters.subject} onChange={(v) => setF('subject', v)} placeholder={`${L('tu_filter_subject')}: ${L('filter_all')}`}
            options={subjectOptions} />
          <Select value={filters.verified} onChange={(v) => setF('verified', v)} placeholder={`${L('tu_filter_verified')}: ${L('filter_all')}`}
            options={[{ value: 'true', label: L('tu_only_verified') }, { value: 'false', label: L('tu_only_unverified') }]} />
          <button className="btn sec sm" onClick={clearFilters}>{L('clear_filters')}</button>
        </div>

        {rows.length === 0 ? <EmptyState msg={L('tu_no_tutors')} ic="🎓" /> : (
          <div className={detail ? 'tu-split has-detail' : 'tu-split'}>
            <div className="tu-list">
              {rows.map((x, i) => (
                <article
                  key={x.id || i}
                  className={selectedIndex === i ? 'tu-row sel' : 'tu-row'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => (selectedIndex === i ? setSelectedIndex(null) : openDetail(i))}
                >
                  <div className="tu-person">
                    <div className="tavatar tu-avatar-colors" style={{ '--tu-avatar-bg': x.avatarColor || 'var(--brand)', '--tu-avatar-ink': x.textColor || '#fff' }}>{x.initials || initialsOf(x.name)}</div>
                    <div className="tu-identity">
                      {/* El estado (Activo/Inactivo) y las insignias de verificado/destacado
                          se movieron acá, al lado del nombre, para no ocupar una fila
                          completa abajo (pedido del usuario). El botón "Ver/Cerrar" se
                          sacó: toda la fila ya es clicable para abrir o cerrar el
                          detalle, así que era un control duplicado. */}
                      <div className="tu-name-row">
                        <b>{x.name}</b>
                        {/* En la lista se muestra sólo el ícono (como la insignia azul de
                            Instagram) para no ocupar tanto espacio; el texto completo
                            "Verificado" se deja únicamente en la ficha del tutor. */}
                        {x.verified && (
                          <span className="tu-verified-ic" title={L('tu_verified')} aria-label={L('tu_verified')}>
                            <IconVerifiedBadge size={15} />
                          </span>
                        )}
                        <Pill value={x.status || 'active'} map={STATUS_TAG} L={L} />
                        {x.featured && <span className="tag w">★ {L('tu_featured')}</span>}
                      </div>
                      <div className="note">{x.contact?.email || L('none')}</div>
                    </div>
                  </div>
                  <div className="tu-offer">
                    <div>{x.subjectsLabel?.[lang] || (x.subjects || []).join(' · ') || L('none')}</div>
                    <div className="chips">{(x.modes || []).map((m) => <span key={m} className="tag">{L('mode_' + m)}</span>)}</div>
                  </div>
                  <div className="tu-price"><b>{x.pricePerHour ? fmt(x.pricePerHour) + ' ' + (x.currency || '') : L('none')}</b><div className="note">{L('tu_price')}</div></div>
                  <div className="tu-rating">{Number(x.rating)> 0 ? <Stars value={x.rating} count={x.reviewCount} /> : <span className="note">{L('none')}</span>}</div>
                </article>
              ))}
            </div>
            {/* En teléfono la ficha quedaba al final de toda la lista (había que hacer
                mucho scroll para verla). Ahora, con el fondo (tu-detail-backdrop) y el
                `position:fixed` que se le da a .tu-detail sólo en esa media query, la
                ficha se abre como una ventana/hoja flotante encima de la lista, que
                queda desenfocada detrás. En escritorio/tablet este backdrop no se
                muestra (display:none por defecto) y la ficha sigue siendo la columna
                de siempre. */}
            {detail && <div className="tu-detail-backdrop" onClick={() => setSelectedIndex(null)} />}
            {detail && <aside className="tu-detail" aria-label={L('tu_detail')}>
              <div className="flex between wrap tu-gap-8 tu-margin-bottom-12 tu-detail-head">
                {/* La flecha "‹" sólo se ve en teléfono (la ficha abierta como ventana);
                    en escritorio/tablet queda oculta y el título sigue como antes. Las
                    dos cumplen la misma función (volver a la lista); no hay una
                    jerarquía de navegación más profunda que distinguirlas. */}
                <button className="btn sec sm icon-only tu-detail-back" onClick={() => setSelectedIndex(null)} aria-label={lang === 'es' ? 'Volver' : 'Back'} title={lang === 'es' ? 'Volver' : 'Back'}><IconChevronLeft size={16} /></button>
                <b className="tu-detail-head-title">{L('tu_detail')}</b>
                <button className="btn sec sm icon-only" onClick={() => setSelectedIndex(null)} aria-label={L('close')} title={L('close')}><IconX size={16} /></button>
              </div>
              {detailError && <ErrorBox msg={detailError} onRetry={() => load(filters)} L={L} />}
              <TutorDetail tutor={detail} loading={detailLoading} ctx={ctx} busy={busy} tab={detailTab} onTabChange={setDetailTab}
                onDeleteReview={(review) => setDialog({ kind: 'review', tutor: detail, review })} />
                                <div className="tu-actions">
                    {/* Íconos agregados para que cada acción se reconozca de un vistazo,
                        sobre todo en teléfono donde el texto solo ya quedaba apretado. */}
                    <button className="btn sec sm" disabled={busy || detailLoading} onClick={() => setDialog({ kind: 'form', tutor: detail })}><IconEdit size={14} /> {L('edit')}</button>
                    <button className="btn sec sm" disabled={busy || detailLoading} onClick={() => setDialog({ kind: 'verify', tutor: detail })}>
                      <IconCheckCircle size={14} /> {detail.verified ? L('tu_unverify') : L('tu_verify')}
                    </button>
                    {/* PUT admite parches parciales: se envía solo el campo que cambia. */}
                    <button className="btn sec sm" disabled={busy || detailLoading} title={L(detail.featured ? 'tu_unfeature' : 'tu_feature')}
                      onClick={() => run(() => api.put(`/tutors/${detail.id}`, { featured: !detail.featured }), L('saved_ok'))}>
                      <IconStar size={14} /> {L(detail.featured ? 'tu_unfeature' : 'tu_feature')}
                    </button>
                    {(detail.status || 'active') === 'active'
                      ? <button className="btn sec sm" disabled={busy || detailLoading} onClick={() => setDialog({ kind: 'pause', tutor: detail })}><IconPause size={14} /> {L('tu_pause')}</button>
                      : <button className="btn sec sm" disabled={busy || detailLoading} onClick={() => run(() => api.put(`/tutors/${detail.id}`, { status: 'active' }), L('saved_ok'))}><IconPlay size={14} /> {L('tu_activate')}</button>}
                    {isAdmin && <button className="btn dgr sm" disabled={busy || detailLoading} onClick={() => setDialog({ kind: 'delete', tutor: detail })} aria-label={L('tu_delete')}><IconTrash size={14} /> {L('tu_delete')}</button>}
                  </div>
            </aside>}
          </div>
        )}
        {err && <ErrorBox msg={err} onRetry={() => load(filters)} L={L} />}
      </Card>

      {dialog?.kind === 'form' && (
        <TutorForm tutor={dialog.tutor} ctx={ctx} busy={busy} suggestions={[...seenSubjects.current]}
          onClose={() => setDialog(null)} onSave={saveTutor} />
      )}

      {dialog?.kind === 'verify' && (
        <VerifyDialog tutor={dialog.tutor} ctx={ctx} busy={busy} onClose={() => setDialog(null)}
          onConfirm={(note) => run(
            () => api.patch(`/tutors/${dialog.tutor.id}/verification`, { verified: !dialog.tutor.verified, note: note || null }),
            L('saved_ok'),
          )} />
      )}

      {/* La pausa se hace con PUT {status,featured} y no con el DELETE «suave»:
          ese DELETE exige rol admin en el backend, mientras que el resto de la
          gestión de tutores es de soporte. PUT logra lo mismo para ambos roles. */}
      {dialog?.kind === 'pause' && (
        <Confirm title={L('tu_pause_title')} message={L('tu_pause_msg', { name: dialog.tutor.name })}
          confirmLabel={L('tu_pause')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => run(() => api.put(`/tutors/${dialog.tutor.id}`, { status: 'paused', featured: false }), L('saved_ok'))} />
      )}

      {dialog?.kind === 'delete' && (
        <Confirm danger title={L('tu_delete_title')} message={L('tu_delete_msg', { name: dialog.tutor.name })}
          confirmLabel={L('tu_delete')} cancelLabel={L('cancel')} busy={busy} onClose={() => setDialog(null)}
          onConfirm={() => run(() => api.del(`/tutors/${dialog.tutor.id}?hard=true`), L('deleted_ok'))} />
      )}

      {dialog?.kind === 'review' && (
        <Confirm danger title={L('tu_del_review')} message={L('tu_del_review_msg')}
          confirmLabel={L('del')} cancelLabel={L('cancel')} busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const { tutor, review } = dialog;
            await run(() => api.del(`/tutors/${tutor.id}/reviews/${review.id}`), L('tu_review_deleted'));
          }} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function TutorForm({ tutor, ctx, busy, suggestions, onClose, onSave }) {
  const { L, lang, fmt } = ctx;
  const [section, setSection] = useState('identity');
  const [f, setF] = useState(() => (tutor ? formFrom(tutor) : emptyForm()));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const onText = (k) => (e) => set(k)(e.target.value);

  return (
    <Modal wide busy={busy} title={tutor ? L('tu_edit') : L('tu_new')} subtitle={tutor ? tutor.id : undefined}
      onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={() => { if (!f.name.trim()) setSection('identity'); else if (!f.subjects.length) setSection('offer'); onSave(f, tutor); }} disabled={busy}>{busy ? '…' : (tutor ? L('save') : L('create'))}</button>
      </>}
>
      <div className="tu-form">
        <div className="tu-form-preview">
          <div className="tavatar tu-avatar-colors tu-width-52 tu-height-52 tu-font-size-18" style={{ '--tu-avatar-bg': f.avatarColor, '--tu-avatar-ink': f.textColor }}>{f.initials || initialsOf(f.name) || 'TU'}</div>
          <div className="tu-form-preview-identity">
            <b>{f.name.trim() || (lang === 'es' ? 'Nombre del tutor' : 'Tutor name')}</b>
            <div className="note">{f.contactEmail || (lang === 'es' ? 'Correo de contacto' : 'Contact email')}</div>
            <div className="chips tu-margin-top-6">
              <Pill value={f.status} map={STATUS_TAG} L={L} />
              {f.featured && <span className="tag w">★ {L('tu_featured')}</span>}
              {(tutor?.verified || (!tutor && f.verified)) && <span className="tag g">✓ {L('tu_verified')}</span>}
            </div>
          </div>
          <div className="tu-form-preview-offer">
            <div>{(lang === 'es' ? f.subjectsLabelEs : f.subjectsLabelEn) || f.subjects.join(' · ') || L('tu_subjects')}</div>
            <div className="note">{f.modes.map((m) => L('mode_' + m)).join(' · ')}</div>
            {f.pricePerHour !== '' && <b>{fmt(Number(f.pricePerHour))} {f.currency} <span className="note">/ h</span></b>}
          </div>
        </div>
        <Tabs active={section} onChange={setSection} tabs={[
          { id: 'identity', label: L('tu_sec_identity') },
          { id: 'offer', label: L('tu_sec_offer') },
          { id: 'profile', label: L('tu_sec_profile') },
          { id: 'reputation', label: lang === 'es' ? 'Reputación' : 'Reputation' },
          { id: 'contact', label: L('tu_sec_contact') },
        ]} />
      <section className="tu-form-section" hidden={section !== 'identity'} aria-label={L('tu_sec_identity')}>
        <h3 className="tu-form-heading">{L('tu_sec_identity')}</h3>
      <FormGrid>
        <Field label={`${L('tu_name')} *`}><input value={f.name} onChange={onText('name')} /></Field>
        <Field label={L('tu_initials')}>
          <input value={f.initials} onChange={onText('initials')} placeholder={initialsOf(f.name)} maxLength={3} />
        </Field>
        <Field label={L('tu_avatar_color')}>
          <div className="flex tu-gap-8">
            <input type="color" value={f.avatarColor} onChange={onText('avatarColor')} />
            <input value={f.avatarColor} onChange={onText('avatarColor')} className="mono" />
          </div>
        </Field>
        <Field label={L('tu_text_color')}>
          <div className="flex tu-gap-8">
            <input type="color" value={f.textColor} onChange={onText('textColor')} />
            <input value={f.textColor} onChange={onText('textColor')} className="mono" />
          </div>
        </Field>
      </FormGrid>

      </section>
      <section className="tu-form-section" hidden={section !== 'offer'} aria-label={L('tu_sec_offer')}>
        <h3 className="tu-form-heading">{L('tu_sec_offer')}</h3>
      <FormGrid>
        <Field wide label={`${L('tu_subjects')} *`} hint={L('tu_subjects_hint')}>
          <TagInput value={f.subjects} onChange={set('subjects')} suggestions={suggestions} placeholder="m1, b1, lectora…" />
        </Field>
        <Field label={`${L('tu_subjects_label')} · ${L('tu_label_es')}`}>
          <input value={f.subjectsLabelEs} onChange={onText('subjectsLabelEs')} placeholder={f.subjects.join(' · ')} />
        </Field>
        <Field label={`${L('tu_subjects_label')} · ${L('tu_label_en')}`}>
          <input value={f.subjectsLabelEn} onChange={onText('subjectsLabelEn')} placeholder={f.subjects.join(' · ')} />
        </Field>
        <Field wide label={L('tu_modes')}>
          <Chips value={f.modes} onChange={set('modes')} options={MODES.map((m) => ({ value: m, label: L(`mode_${m}`) }))} />
        </Field>
        <Field label={`${L('tu_modes_label')} · ${L('tu_label_es')}`}><input value={f.modesLabelEs} onChange={onText('modesLabelEs')} /></Field>
        <Field label={`${L('tu_modes_label')} · ${L('tu_label_en')}`}><input value={f.modesLabelEn} onChange={onText('modesLabelEn')} /></Field>
        <Field label={L('tu_price')}><input type="number" min="0" value={f.pricePerHour} onChange={onText('pricePerHour')} /></Field>
        <Field label={L('tu_currency')}><input value={f.currency} onChange={onText('currency')} maxLength={4} /></Field>
      </FormGrid>

      </section>
      <section className="tu-form-section" hidden={section !== 'profile'} aria-label={L('tu_sec_profile')}>
        <h3 className="tu-form-heading">{L('tu_sec_profile')}</h3>
      <FormGrid>
        <Field label={L('tu_country')}><input value={f.country} onChange={onText('country')} maxLength={4} /></Field>
        <Field label={L('tu_years')}><input type="number" min="0" value={f.yearsExperience} onChange={onText('yearsExperience')} /></Field>
        <Field wide label={L('tu_languages')}>
          <TagInput value={f.languages} onChange={set('languages')} suggestions={['es', 'en']} placeholder="es, en…" />
        </Field>
        <Field wide label={L('tu_bio_es')}><textarea value={f.bioEs} onChange={onText('bioEs')} /></Field>
        <Field wide label={L('tu_bio_en')}><textarea value={f.bioEn} onChange={onText('bioEn')} /></Field>
        <Field label={L('tu_status')}>
          <Select value={f.status} onChange={set('status')} options={STATUSES.map((s) => ({ value: s, label: L(STATUS_TAG[s][1]) }))} />
        </Field>
        <div className="field">
          <Check label={`★ ${L('tu_featured')}`} checked={f.featured} onChange={set('featured')} />
          {!tutor && <Check label={`✓ ${L('tu_verified')}`} checked={f.verified} onChange={set('verified')} />}
        </div>
      </FormGrid>

      </section>
      <section className="tu-form-section" hidden={section !== 'reputation'} aria-label={L('tu_sec_reputation')}>
        <h3 className="tu-form-heading">{L('tu_sec_reputation')}</h3>
      <p className="note tu-margin-bottom-8">{L('tu_seed_hint')}</p>
      <FormGrid>
        {CRITERIA.map((c, i) => (
          <Field key={c} label={L(`crit_${c}`)}>
            <input type="number" min="0" max="5" step="0.1"
              value={[f.seedTeaching, f.seedPunctuality, f.seedMastery][i]}
              onChange={onText(['seedTeaching', 'seedPunctuality', 'seedMastery'][i])} />
          </Field>
        ))}
        <Field label={L('tu_review_count_seed')}>
          <input type="number" min="0" value={f.reviewCountSeed} onChange={onText('reviewCountSeed')} />
        </Field>
      </FormGrid>

      </section>
      <section className="tu-form-section" hidden={section !== 'contact'} aria-label={L('tu_sec_contact')}>
        <h3 className="tu-form-heading">{L('tu_sec_contact')}</h3>
      <FormGrid>
        <Field label={L('tu_contact_email')}><input type="email" value={f.contactEmail} onChange={onText('contactEmail')} /></Field>
        <Field label="WhatsApp"><input value={f.contactWhatsapp} onChange={onText('contactWhatsapp')} placeholder="+569…" /></Field>
        <div className="field span-2">
          <Check label={L('tu_contact_sharing')} checked={f.contactSharingDefault} onChange={set('contactSharingDefault')} />
        </div>
      </FormGrid>
      </section>
      </div>
    </Modal>
  );
}

function TutorDetail({ tutor, loading, ctx, busy, onDeleteReview, tab, onTabChange }) {
  const { L, lang, fmt } = ctx;
  const reviews = tutor.reviews || [];
  const date = (s) => (s ? new Date(s).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : L('none'));

  return (
    <div className="tu-detail-content">
      {loading ? <Loading L={L} /> : (
        <>
          {/* En teléfono este bloque se centra (avatar grande arriba, nombre e
              insignias, rating y materia debajo, en ese orden) para que la ficha se
              vea como la ventana flotante del mockup, sin el ID técnico del tutor
              (tu-detail-id se oculta ahí, no aporta nada a un apoderado/admin mirando
              desde el celular). En escritorio queda igual que siempre. */}
          <div className="flex wrap tu-gap-12 tu-margin-bottom-14 tu-detail-top">
            <div className="tavatar tu-width-48 tu-height-48 tu-font-size-15 tu-avatar-colors tu-detail-avatar" style={{ '--tu-avatar-bg': tutor.avatarColor, '--tu-avatar-ink': tutor.textColor || '#fff' }}>
              {tutor.initials || initialsOf(tutor.name)}
            </div>
            <div className="tu-flex-1-1-160px tu-min-width-0 tu-detail-identity">
              <div className="flex wrap tu-gap-6 tu-detail-name-row">
                <b className="tu-font-size-15">{tutor.name}</b>
                {tutor.verified && <span className="tag g">✓ {L('tu_verified')}</span>}
                {tutor.featured && <span className="tag w">★ {L('tu_featured')}</span>}
                <Pill value={tutor.status || 'active'} map={STATUS_TAG} L={L} />
                {tutor.online && <span className="tag g"><span className="dot ok tu-margin-right-5"  />online</span>}
              </div>
              <div className="note mono tu-detail-id">{tutor.id}</div>
              <Stars value={tutor.rating} count={tutor.reviewCount} />
              <div className="note tu-detail-subject">{tutor.subjectsLabel?.[lang] || (tutor.subjects || []).join(' · ')}</div>
            </div>
          </div>

          <Tabs active={tab} onChange={onTabChange} tabs={[
            { id: 'profile', label: L('tu_sec_profile') },
            { id: 'reputation', label: lang === 'es' ? 'Reputación' : 'Reputation' },
            { id: 'contact', label: L('tu_sec_contact') },
            { id: 'verification', label: lang === 'es' ? 'Verificación' : 'Verification' },
          ]} />
          <div className="grid tu-facts">
            <div className="tu-fact" hidden={tab !== 'profile' }>
              <div className="section-label tu-margin-top-0">{L('tu_sec_offer')}</div>
              <KV ic={<IconDollarSign size={14} />} k={L('tu_price')} v={tutor.pricePerHour ? `${fmt(tutor.pricePerHour)} ${tutor.currency || ''}` : L('none')} />
              <KV ic={<IconMapPin size={14} />} k={L('tu_modes')} v={(tutor.modes || []).map((m) => L(`mode_${m}`)).join(' · ')} />
              <KV ic={<IconGlobe size={14} />} k={L('tu_country')} v={tutor.country} />
              <KV ic={<IconLanguages size={14} />} k={L('tu_languages')} v={(tutor.languages || []).join(', ')} />
              <KV ic={<IconCalendar size={14} />} k={L('tu_years')} v={tutor.yearsExperience} />
            </div>
            <div className="tu-fact" hidden={tab !== 'reputation' }>
              <div className="section-label tu-margin-top-0">{L('tu_sec_reputation')}</div>
              <KV k={L('tu_rating_computed')} v={<Stars value={tutor.rating} count={tutor.reviewCount} />} />
              {CRITERIA.map((c) => <KV key={c} k={`${L(`crit_${c}`)} (histórico)`} v={tutor.ratingSeed?.[c] ?? L('none')} />)}
              <KV k={L('tu_review_count_seed')} v={tutor.reviewCountSeed ?? 0} />
            </div>
            <div className="tu-fact" hidden={tab !== 'contact' }>
              <div className="section-label tu-margin-top-0">{L('tu_sec_contact')}</div>
              <KV k={L('tu_contact_email')} v={tutor.contact?.email} />
              <KV k="WhatsApp" v={tutor.contact?.whatsapp} />
              <KV k={L('tu_contact_sharing')} v={tutor.contactSharingDefault !== false ? L('yes') : L('no')} />
              <KV k={L('tu_contact_requests')} v={fmt(tutor.contactRequests || 0)} />
            </div>
            <div className="tu-fact" hidden={tab !== 'verification' }>
              <div className="section-label tu-margin-top-0">{L('tu_verify_title')}</div>
              <KV k={L('tu_verified')} v={tutor.verified ? L('yes') : L('no')} />
              <KV k={L('tu_verified_at')} v={date(tutor.verifiedAt)} />
              <KV k={L('tu_verified_by')} v={tutor.verifiedBy} />
              <KV k={L('tu_verify_note_saved')} v={tutor.verificationNote} />
            </div>
          </div>

          {tab === 'profile' && (tutor.bio?.es || tutor.bio?.en) && (
            <>
              <div className="section-label">{L('tu_bio_es')}</div>
              <p className="tu-font-size-13 tu-line-height-1-6">{tutor.bio?.[lang] || tutor.bio?.es}</p>
            </>
          )}

          <div hidden={tab !== 'reputation'}>
          <div className="section-label">{L('tu_reviews')} ({reviews.length})</div>
          {reviews.length === 0 ? <EmptyState msg={L('tu_no_reviews')} ic="💬" /> : reviews.map((rv) => (
            <div key={rv.id} className="review">
              <div className="rhead">
                <div className="flex tu-gap-8">
                  <div className="avatar">{rv.userInitials || initialsOf(rv.userName)}</div>
                  <div>
                    <b className="tu-font-size-12-5">{rv.userName || rv.userId}</b>
                    <div className="note">{date(rv.createdAt)}{rv.lessonsTaken ? ` · ${rv.lessonsTaken} clases` : ''}</div>
                  </div>
                </div>
                <div className="flex tu-gap-8">
                  <Stars value={rv.overall ?? 0} />
                  <button className="btn dgr sm" disabled={busy} onClick={() => onDeleteReview(rv)} aria-label={L('tu_del_review')}>{L('del')}</button>
                </div>
              </div>
              {rv.comment && <p className="tu-font-size-12-5 tu-margin-top-8 tu-line-height-1-55">{rv.comment}</p>}
              <div className="chips tu-margin-top-8">
                {CRITERIA.map((c) => (
                  <span key={c} className="tag">{L(`crit_${c}`)}: {rv.ratings?.[c] ?? '—'}</span>
                ))}
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
}

function VerifyDialog({ tutor, ctx, busy, onClose, onConfirm }) {
  const { L } = ctx;
  const [note, setNote] = useState(tutor.verificationNote || '');
  const turningOn = !tutor.verified;

  return (
    <Modal busy={busy} title={L('tu_verify_title')} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className={`btn ${turningOn ? '' : 'dgr'}`} onClick={() => onConfirm(note)} disabled={busy}>
          {busy ? '…' : L(turningOn ? 'tu_verify' : 'tu_unverify')}
        </button>
      </>}>
      <p className="tu-font-size-13-5 tu-line-height-1-6">
        {L(turningOn ? 'tu_verify_msg' : 'tu_unverify_msg', { name: tutor.name })}
      </p>
      <Field label={L('tu_verify_note')}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('tu_verify_note_ph')} />
      </Field>
    </Modal>
  );
}

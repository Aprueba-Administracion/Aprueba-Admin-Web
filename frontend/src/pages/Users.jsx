import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  TopKpiCard, Card, Loading, ErrorBox, EmptyState, Modal, Field, FormGrid, Select,
  Tabs, Toast, useToast, KV, Pill, Pager,
  IconUsers, IconCheckCircle, IconBan, IconTicket,
} from '../components/ui.jsx';

const USER_STATES = ['active', 'suspended', 'churned'];
const STATE_TAG = { active: ['g', 'us_active'], suspended: ['w', 'us_suspended'], churned: ['d', 'us_churned'] };
const PRI_TAG = { high: ['d', 'pri_high'], med: ['w', 'pri_med'], low: ['', 'pri_low'] };
const TICKET_TAG = { open: ['d', 'ts_open'], progress: ['w', 'ts_progress'], closed: ['g', 'ts_closed'] };
const COR_TAG = { pending: ['w', 'cs_pending'], confirmed: ['g', 'cs_confirmed'], rejected: ['d', 'cs_rejected'] };
// Recompensa fija que el backend otorga al confirmar (routes/corrections.js).
const CONFIRM_REWARD = 250;
// Planes conocidos por si el rol no puede leer /admin/plans (solo gerencia).
const FALLBACK_PLANS = [{ id: 'free', name: 'Gratis' }, { id: 'uni', name: '1 prueba' }, { id: 'all', name: 'Todas' }];
// Agentes conocidos por si /admin/agents falla (mismo criterio de respaldo que FALLBACK_PLANS).
const FALLBACK_AGENTS = [{ id: 'adm_1', name: 'Admin General', role: 'admin' }, { id: 'adm_4', name: 'Soporte', role: 'support' }];

const PAGE_SIZE = 20;
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Iconos del panel de detalle de usuario (estilo que ya usaba Amaru en su
// versión de Usuarios; se mantienen como SVG inline en vez de emojis).
const SvgSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const SvgEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const SvgCreditCard = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);
const SvgClock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const SvgAward = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);
const SvgCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export default function Users({ ctx }) {
  const { L, fmt, lang } = ctx;
  const { isAdmin, user: me } = useAuth();
  const t = useToast();

  const [tab, setTab] = useState('users');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  // ── usuarios (paginados por cursor) ──
  const [uFilters, setUFilters] = useState({ q: '', plan: '', state: '' });
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState(null);
  const [uTotal, setUTotal] = useState(0);
  const [uNext, setUNext] = useState(null);
  const [uErr, setUErr] = useState(null);
  // Conteos globales para los KPI (antes se calculaban solo sobre la página
  // de usuarios cargada, lo que subcontaba si había más de una página).
  const [uStats, setUStats] = useState(null);
  // Usuario elegido en la lista para ver el panel de detalle al lado
  // (estilo maestro-detalle, en vez del modal antiguo para "ver ficha").
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSubTab, setUserSubTab] = useState('summary');

  // ── tickets / recorrecciones ──
  // Los filtros usan `status` (no `state`) desde Fase 2 #1/#6, alineado al
  // modelo canónico de Max: state era el nombre en el doc de endpoints, pero
  // el modelo de datos usa status.
  const [tFilters, setTFilters] = useState({ status: '', priority: '' });
  const [tickets, setTickets] = useState(null);
  const [tErr, setTErr] = useState(null);
  // Conteos globales que manda el backend (meta.openCount/pendingCount, ver
  // GET /tickets y /corrections): no dependen de los filtros activos, a
  // diferencia de `tickets`/`corrections`, que son solo la página filtrada.
  const [openTickets, setOpenTickets] = useState(0);
  const [cFilters, setCFilters] = useState({ status: '' });
  const [corrections, setCorrections] = useState(null);
  const [cErr, setCErr] = useState(null);
  const [pendingCor, setPendingCor] = useState(0);

  // ── catálogos auxiliares ──
  const [plans, setPlans] = useState(null);
  const [agents, setAgents] = useState(null);
  const [questionsById, setQuestionsById] = useState(null);

  const planOptions = (plans || FALLBACK_PLANS).map((p) => ({ value: p.id, label: p.name }));
  const planName = (id) => (plans || FALLBACK_PLANS).find((p) => p.id === id)?.name || id || L('none');
  const agentOptions = (agents || FALLBACK_AGENTS).map((a) => ({ value: a.id, label: a.name }));

  const loadUserStats = useCallback(async () => {
    try { setUStats((await api.get('/users/stats')).data); } catch { /* las tarjetas simplemente no muestran conteo */ }
  }, []);

  const loadUsers = useCallback(async (f, cursor) => {
    setUErr(null);
    try {
      const r = await api.get(`/users${qs({ ...f, limit: PAGE_SIZE, cursor })}`);
      setUsers(r.data);
      setUTotal(r.meta?.pagination?.total ?? r.data.length);
      setUNext(r.meta?.pagination?.nextCursor ?? null);
      // Si el usuario abierto en el panel de detalle sigue en la página
      // recargada, se refresca con los datos nuevos; si no, se deja como está.
      setSelectedUser((prev) => (prev ? r.data.find((u) => u.id === prev.id) || prev : null));
    } catch (e) { setUErr(e.message); }
  }, []);

  const loadTickets = useCallback(async (f) => {
    setTErr(null);
    try {
      const r = await api.get(`/tickets${qs(f)}`);
      setTickets(r.data);
      setOpenTickets(r.meta?.openCount ?? 0);
    } catch (e) { setTErr(e.message); }
  }, []);

  const loadCorrections = useCallback(async (f) => {
    setCErr(null);
    try {
      const r = await api.get(`/corrections${qs(f)}`);
      setCorrections(r.data);
      setPendingCor(r.meta?.pendingCount ?? 0);
    } catch (e) { setCErr(e.message); }
  }, []);

  // El catálogo de planes solo lo puede leer gerencia; si falla, se usa el fallback.
  useEffect(() => { api.get('/plans').then((r) => setPlans(r.data)).catch(() => setPlans(null)); }, []);
  // Agentes válidos para asignar tickets (roles support/admin); si el endpoint
  // falla se usa el fallback fijo.
  useEffect(() => { api.get('/agents').then((r) => setAgents(r.data)).catch(() => setAgents(null)); }, []);

  useEffect(() => { loadUserStats(); }, [loadUserStats]);

  // Cada bloque recarga cuando cambian sus filtros (la primera ejecución hace la carga inicial).
  useEffect(() => { setCursors([null]); setPage(0); loadUsers(uFilters, null); }, [uFilters, loadUsers]);
  useEffect(() => { loadTickets(tFilters); }, [tFilters, loadTickets]);
  useEffect(() => { loadCorrections(cFilters); }, [cFilters, loadCorrections]);
  useEffect(() => {
    const id = setTimeout(() => setUFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(id);
  }, [search]);

  // El enunciado de la pregunta recorregida vive en /questions (rol gerencia).
  useEffect(() => {
    if (tab !== 'corrections' || !isAdmin || questionsById) return;
    api.get('/questions')
      .then((r) => setQuestionsById(Object.fromEntries(r.data.map((q) => [q.id, q]))))
      .catch(() => setQuestionsById({}));
  }, [tab, isAdmin, questionsById]);

  const goNext = () => {
    if (!uNext) return;
    setCursors([...cursors.slice(0, page + 1), uNext]);
    setPage(page + 1);
    loadUsers(uFilters, uNext);
  };
  const goPrev = () => {
    if (page === 0) return;
    setPage(page - 1);
    loadUsers(uFilters, cursors[page - 1]);
  };

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const out = await fn();
      setDialog(null);
      if (okMsg) t.ok(okMsg);
      return out;
    } catch (e) { t.err(e.message); return null; } finally { setBusy(false); }
  };

  const patchUser = async (u, patch) => {
    if (await run(() => api.patch(`/users/${u.id}`, patch), L('saved_ok'))) {
      loadUsers(uFilters, cursors[page]);
      // Un cambio de estado (suspender/reactivar) mueve los conteos globales.
      if ('state' in patch) loadUserStats();
    }
  };

  const patchTicket = async (tk, patch) => {
    if (await run(() => api.patch(`/tickets/${tk.id}`, patch), L('saved_ok'))) loadTickets(tFilters);
  };

  const resolveCorrection = async (cor, body) => {
    const out = await run(() => api.patch(`/corrections/${cor.id}`, body));
    if (!out) return;
    const reward = out.data?.rewardGranted;
    t.ok(reward ? L('co_reward_granted', { n: reward.amount ?? CONFIRM_REWARD }) : L('co_rejected'));
    loadCorrections(cFilters);
    // Confirmar acredita badges al alumno: refrescamos también la tabla de usuarios.
    if (reward) loadUsers(uFilters, cursors[page]);
  };

  const openUser = async (u) => {
    setDialog({ kind: 'user', user: u, loading: true });
    try { setDialog({ kind: 'user', user: (await api.get(`/users/${u.id}`)).data }); }
    catch (e) { t.err(e.message); setDialog({ kind: 'user', user: u }); }
  };

  if (!users && !uErr) return <Loading L={L} />;

  return (
    <>
      <div className="grid g4">
        <TopKpiCard label={L('u_total')} value={fmt(uStats?.total ?? uTotal)} icon={IconUsers} tone="blue" />
        <TopKpiCard label={L('u_active')} value={uStats ? fmt(uStats.active) : '…'} icon={IconCheckCircle} tone="blue" />
        <TopKpiCard label={L('u_suspended')} value={uStats ? fmt(uStats.suspended) : '…'} icon={IconBan} tone="blue" />
        <TopKpiCard label={L('u_tickets')} value={fmt(openTickets)} icon={IconTicket} tone="blue" />
      </div>

      <div style={{ marginTop: 18 }}>
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: 'users', ic: '👥', label: L('tab_users'), count: uTotal },
          { id: 'tickets', ic: '🎫', label: L('tab_tickets'), count: openTickets },
          { id: 'corrections', ic: '⚑', label: L('tab_corrections'), count: pendingCor },
        ]} />
      </div>

      {tab === 'users' && (
        <Card className="tab-fade">
          <div className="filters mb">
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <input className="grow" style={{ width: '100%', paddingLeft: 32 }} placeholder={L('u_search')}
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <SvgSearch />
              </span>
            </div>
            <Select value={uFilters.plan} onChange={(v) => setUFilters((f) => ({ ...f, plan: v }))}
              options={planOptions} placeholder={`${L('u_plan')}: ${L('filter_all')}`} />
            <Select value={uFilters.state} onChange={(v) => setUFilters((f) => ({ ...f, state: v }))}
              options={USER_STATES.map((s) => ({ value: s, label: L(STATE_TAG[s][1]) }))} placeholder={`${L('u_state')}: ${L('filter_all')}`} />
            <button className="btn sec sm" onClick={() => { setSearch(''); setUFilters({ q: '', plan: '', state: '' }); }}>{L('clear_filters')}</button>
          </div>
          {uErr && <ErrorBox msg={uErr} onRetry={() => loadUsers(uFilters, cursors[page])} L={L} />}
          {users?.length === 0 ? <EmptyState msg={L('u_no_users')} ic="👥" /> : (
            // Lista maestro-detalle: la tabla se reemplazó por tarjetas de usuario
            // + un panel de detalle al lado (con sub-pestañas), estilo que ya
            // había hecho Amaru; se conserva la paginación y los filtros de antes.
            <div className="u-split" style={{ gridTemplateColumns: selectedUser ? '460px 1fr' : '1fr' }}>
              <div className="u-list">
                <div className="u-rows">
                  {(users || []).map((x) => {
                    const isSel = selectedUser?.id === x.id;
                    return (
                      <div key={x.id} className={`u-row ${isSel ? 'sel' : ''}`}>
                        <div className="flex" style={{ gap: 12, flex: '1 1 200px', minWidth: 0 }}>
                          <div className="avatar">{initials(x.name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
                            <div className="note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.email}</div>
                          </div>
                        </div>
                        <Pill value={x.state} map={STATE_TAG} L={L} />
                        <button type="button" className={`btn sm ${isSel ? '' : 'sec'}`}
                          onClick={() => { setSelectedUser(isSel ? null : x); setUserSubTab('summary'); }}
                          style={{ whiteSpace: 'nowrap' }}>
                          {isSel ? L('u_close_detail') : L('u_view_detail')}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <Pager page={page} shown={users?.length || 0} total={uTotal} hasNext={!!uNext} onNext={goNext} onPrev={goPrev} L={L} />
                </div>
              </div>

              {selectedUser && (
                <div className="u-detail">
                  <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 20, alignItems: 'flex-start' }}>
                    <div className="flex" style={{ gap: 14 }}>
                      <div className="avatar lg">{initials(selectedUser.name)}</div>
                      <div>
                        <div className="flex" style={{ gap: 10 }}>
                          <h2 style={{ margin: 0, fontSize: 18 }}>{selectedUser.name}</h2>
                          <Pill value={selectedUser.state} map={STATE_TAG} L={L} />
                        </div>
                        <span className="note">{selectedUser.email}</span>
                      </div>
                    </div>
                    <div className="flex" style={{ gap: 8 }}>
                      <button type="button" className="btn sec sm" onClick={() => openUser(selectedUser)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <SvgEdit /><span>{L('edit')}</span>
                      </button>
                      <button type="button" className="btn sec sm" disabled={busy}
                        onClick={() => patchUser(selectedUser, { state: selectedUser.state === 'suspended' ? 'active' : 'suspended', reason: 'Acción rápida desde consola' })}>
                        {selectedUser.state === 'suspended' ? L('u_reactivate') : L('u_suspend')}
                      </button>
                      <button type="button" onClick={() => setSelectedUser(null)} title={L('u_close_detail')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '4px 6px' }}>
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="u-subtabs">
                    {[
                      { id: 'summary', label: L('u_summary_tab') },
                      { id: 'activity', label: L('u_activity_tab') },
                      { id: 'tickets', label: L('tab_tickets') },
                      { id: 'corrections', label: L('tab_corrections') },
                    ].map((st) => (
                      <button key={st.id} type="button" className={`u-subtab ${userSubTab === st.id ? 'on' : ''}`}
                        onClick={() => setUserSubTab(st.id)}>{st.label}</button>
                    ))}
                  </div>

                  {userSubTab === 'summary' && (
                    <div className="u-stats">
                      <div className="u-stat"><span className="u-stat-ic"><SvgCreditCard /></span>
                        <div><div className="note">{L('u_plan')}</div><div className="u-stat-val">{planName(selectedUser.plan)}</div></div></div>
                      <div className="u-stat"><span className="u-stat-ic"><SvgClock /></span>
                        <div><div className="note">{L('u_last')}</div><div className="u-stat-val">{selectedUser.lastActiveLabel || L('none')}</div></div></div>
                      <div className="u-stat"><span className="u-stat-ic"><SvgAward /></span>
                        <div><div className="note">{L('u_badges')}</div><div className="u-stat-val">{fmt(selectedUser.badgesTotal ?? 0)}</div></div></div>
                      <div className="u-stat"><span className="u-stat-ic"><SvgCalendar /></span>
                        <div><div className="note">{L('u_registered')}</div>
                          <div className="u-stat-val">
                            {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : L('none')}
                          </div>
                        </div></div>
                    </div>
                  )}

                  {userSubTab === 'activity' && (
                    <p className="note" style={{ padding: '24px 0', textAlign: 'center' }}>{L('u_no_activity')}</p>
                  )}

                  {userSubTab === 'tickets' && (() => {
                    const own = (tickets || []).filter((tk) => tk.userId === selectedUser.id || tk.userName === selectedUser.name);
                    return own.length === 0 ? <EmptyState msg={L('u_no_user_tickets')} ic="🎫" /> : own.map((tk) => (
                      <div key={tk.id} className="u-mini-row">
                        <div><b>#{tk.number ?? tk.id}</b> {tk.subject}</div>
                        <Pill value={tk.status} map={TICKET_TAG} L={L} />
                      </div>
                    ));
                  })()}

                  {userSubTab === 'corrections' && (() => {
                    const own = (corrections || []).filter((c) => c.userId === selectedUser.id || c.userName === selectedUser.name);
                    return own.length === 0 ? <EmptyState msg={L('u_no_user_corrections')} ic="⚑" /> : own.map((c) => (
                      <div key={c.id} className="u-mini-row">
                        <div><b>{c.questionStatement || c.questionId}</b>: <span className="note">{c.comment}</span></div>
                        <Pill value={c.status || 'pending'} map={COR_TAG} L={L} />
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === 'tickets' && (
        <Card className="tab-fade">
          <div className="filters mb">
            <b style={{ marginRight: 'auto' }}>{L('t_table')}</b>
            <Select value={tFilters.status} onChange={(v) => setTFilters((f) => ({ ...f, status: v }))}
              options={Object.keys(TICKET_TAG).map((s) => ({ value: s, label: L(TICKET_TAG[s][1]) }))} placeholder={`${L('t_state')}: ${L('filter_all')}`} />
            <Select value={tFilters.priority} onChange={(v) => setTFilters((f) => ({ ...f, priority: v }))}
              options={Object.keys(PRI_TAG).map((s) => ({ value: s, label: L(PRI_TAG[s][1]) }))} placeholder={`${L('t_pri')}: ${L('filter_all')}`} />
            <button className="btn sec sm" onClick={() => setTFilters({ status: '', priority: '' })}>{L('clear_filters')}</button>
          </div>
          {tErr && <ErrorBox msg={tErr} onRetry={() => loadTickets(tFilters)} L={L} />}
          {!tickets ? <Loading L={L} /> : tickets.length === 0 ? <EmptyState msg={L('t_no_tickets')} ic="🎫" /> : (
            <div className="tbl-wrap pretty"><table>
              <thead><tr>
                <th>{L('t_number')}</th><th>{L('t_subj')}</th><th>{L('t_user')}</th>
                <th>{L('t_pri')}</th><th>{L('t_state')}</th><th>{L('t_age')}</th><th />
              </tr></thead>
              <tbody>{tickets.map((x) => (
                <tr key={x.id}>
                  <td className="note">#{x.number ?? x.id}</td>
                  <td>
                    <b className="clamp" style={{ fontSize: 13 }}>{x.subject}</b>
                    {x.category && <div className="note">{L(`cat_${x.category}`)}</div>}
                  </td>
                  <td>{x.userName || x.user}</td>
                  <td><Pill value={x.priority} map={PRI_TAG} L={L} /></td>
                  <td><Pill value={x.status} map={TICKET_TAG} L={L} /></td>
                  <td className="note">{x.ageLabel || x.age}</td>
                  <td><div className="row-acts">
                    <button className="btn sec sm" onClick={() => setDialog({ kind: 'ticket', ticket: x })}>{L('t_manage')}</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {tab === 'corrections' && (
        <Card className="tab-fade">
          <div className="filters mb">
            <b style={{ marginRight: 'auto' }}>{L('co_table')}</b>
            <Select value={cFilters.status} onChange={(v) => setCFilters({ status: v })}
              options={Object.keys(COR_TAG).map((s) => ({ value: s, label: L(COR_TAG[s][1]) }))} placeholder={`${L('t_state')}: ${L('filter_all')}`} />
            <button className="btn sec sm" onClick={() => setCFilters({ status: '' })}>{L('clear_filters')}</button>
          </div>
          {!isAdmin && <p className="note" style={{ marginBottom: 10 }}>ℹ️ {L('co_needs_admin')}</p>}
          {cErr && <ErrorBox msg={cErr} onRetry={() => loadCorrections(cFilters)} L={L} />}
          {!corrections ? <Loading L={L} /> : corrections.length === 0 ? <EmptyState msg={L('co_no_items')} ic="⚑" /> : (
            <div className="tbl-wrap pretty"><table>
              <thead><tr>
                <th>{L('co_question')}</th><th>{L('co_user')}</th><th>{L('co_reason')}</th>
                <th>{L('co_comment')}</th><th>{L('t_state')}</th><th>{L('co_created')}</th><th />
              </tr></thead>
              <tbody>{corrections.map((c) => {
                const q = questionsById?.[c.questionId];
                return (
                  <tr key={c.id}>
                    <td>
                      <b className="clamp" style={{ fontSize: 13 }}>{q?.statement || c.questionStatement || c.questionId}</b>
                      <div className="note">{c.questionId}</div>
                    </td>
                    <td>{c.userName || c.userId}</td>
                    <td><span className="tag">{L(`reason_${c.reason}`)}</span></td>
                    <td><span className="note clamp">{c.comment}</span></td>
                    <td><Pill value={c.status || 'pending'} map={COR_TAG} L={L} /></td>
                    <td className="note">{c.createdAt ? new Date(c.createdAt).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : L('none')}</td>
                    <td><div className="row-acts">
                      <button className="btn sec sm" disabled={(c.status || 'pending') !== 'pending'}
                        onClick={() => setDialog({ kind: 'correction', correction: c, question: q })}>
                        {L('co_resolve')}
                      </button>
                    </div></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </Card>
      )}

      {dialog?.kind === 'user' && (
        <UserDialog user={dialog.user} loading={dialog.loading} ctx={ctx} busy={busy} planOptions={planOptions}
          plansUnavailable={!plans} onClose={() => setDialog(null)}
          onSave={(patch) => patchUser(dialog.user, patch)} />
      )}

      {dialog?.kind === 'ticket' && (
        <TicketDialog ticket={dialog.ticket} ctx={ctx} busy={busy} me={me} agentOptions={agentOptions}
          onClose={() => setDialog(null)} onSave={(patch) => patchTicket(dialog.ticket, patch)} />
      )}

      {dialog?.kind === 'correction' && (
        <CorrectionDialog correction={dialog.correction} question={dialog.question} ctx={ctx} busy={busy}
          isAdmin={isAdmin} onClose={() => setDialog(null)}
          onResolve={(body) => resolveCorrection(dialog.correction, body)} />
      )}

      <Toast toast={t.toast} onDone={t.clear} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function UserDialog({ user, loading, ctx, busy, planOptions, plansUnavailable, onClose, onSave }) {
  const { L, fmt } = ctx;
  const [pendingEmail, setPendingEmail] = useState(user.pendingEmail || '');
  const [plan, setPlan] = useState(user.plan || '');
  const [state, setState] = useState(user.state || 'active');
  const [reason, setReason] = useState('');

  // Cuando llega el detalle completo del API se refrescan los campos editables.
  useEffect(() => {
    setPendingEmail(user.pendingEmail || ''); setPlan(user.plan || ''); setState(user.state || 'active');
  }, [user]);

  const dirty = pendingEmail !== (user.pendingEmail || '') || plan !== (user.plan || '') || state !== (user.state || 'active');

  // El PATCH del API es parcial: solo se envía lo que cambió. La consola ya
  // no escribe el `email` real (espejo de Firebase Auth), solo pendingEmail.
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
          <div className="flex" style={{ gap: 12, marginBottom: 14 }}>
            <div className="avatar md">{initials(user.name)}</div>
            <div>
              <b style={{ fontSize: 15 }}>{user.name}</b>
              <div className="note">{user.email}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}><Pill value={user.state} map={STATE_TAG} L={L} /></div>
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
              <KV k={L('u_badges')} v={`${fmt(user.badgesTotal ?? 0)} 🏅`} />
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

function TicketDialog({ ticket, ctx, busy, me, agentOptions, onClose, onSave }) {
  const { L } = ctx;
  const [detail, setDetail] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [status, setStatus] = useState(ticket.status || 'open');
  const [priority, setPriority] = useState(ticket.priority || 'med');
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId || '');
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');

  // El GET de la fila no trae el hilo de mensajes (supportTickets/{id}/messages);
  // se pide aparte al abrir el diálogo.
  useEffect(() => {
    let alive = true;
    api.get(`/tickets/${ticket.id}`)
      .then((r) => { if (alive) setDetail(r.data); })
      .catch((e) => { if (alive) setLoadErr(e.message); });
    return () => { alive = false; };
  }, [ticket.id]);

  const t = detail || ticket;

  const submit = () => {
    const patch = {};
    if (status !== (t.status || 'open')) patch.status = status;
    if (priority !== (t.priority || 'med')) patch.priority = priority;
    if (assigneeId !== (t.assigneeId || '')) patch.assigneeId = assigneeId || null;
    if (reply.trim()) patch.reply = reply.trim();
    if (internalNote.trim()) patch.internalNote = internalNote.trim();
    if (!Object.keys(patch).length) { onClose(); return; }
    onSave(patch);
  };

  return (
    <Modal wide busy={busy} title={L('t_manage')} subtitle={`#${t.number ?? t.id} · ${t.userName || t.user}`} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className="btn" onClick={submit} disabled={busy}>{busy ? '…' : L('save')}</button>
      </>}>
      <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{t.subject}</p>
      <div className="note" style={{ marginBottom: 6 }}>
        {L('t_age')}: {t.ageLabel || t.age}
        {t.category && <> · {L('t_category')}: {L(`cat_${t.category}`)}</>}
        {t.channel && <> · {L('t_channel')}: {L(`chan_${t.channel}`)}</>}
        {t.userEmail && <> · {t.userEmail}</>}
      </div>
      {t.status === 'closed' && t.closedAt && (
        <div className="note" style={{ marginBottom: 6 }}>{L('t_closed_at')}: {new Date(t.closedAt).toLocaleString()}</div>
      )}

      <div className="section-label" style={{ marginTop: 10 }}>{L('t_thread')}</div>
      {loadErr && <ErrorBox msg={loadErr} L={L} />}
      {!detail && !loadErr ? <Loading L={L} /> : (
        <div className="msg-thread">
          {(t.messages || []).length === 0 && <p className="note">{L('t_no_messages')}</p>}
          {(t.messages || []).map((m) => (
            <div key={m.id} className={`msg ${m.authorType} ${m.internal ? 'internal' : ''}`}>
              <div className="msg-meta">
                <span><b>{m.authorName}</b>{m.internal && <> · {L('t_internal')}</>}</span>
                <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
              </div>
              {m.body}
            </div>
          ))}
        </div>
      )}

      <FormGrid>
        <Field label={L('t_state')}>
          <Select value={status} onChange={setStatus} options={Object.keys(TICKET_TAG).map((s) => ({ value: s, label: L(TICKET_TAG[s][1]) }))} />
        </Field>
        <Field label={L('t_pri')}>
          <Select value={priority} onChange={setPriority} options={Object.keys(PRI_TAG).map((s) => ({ value: s, label: L(PRI_TAG[s][1]) }))} />
        </Field>
        <Field wide label={L('t_assignee')} hint={!assigneeId ? L('t_unassigned') : t.assigneeName}>
          <div className="flex" style={{ gap: 8 }}>
            <Select value={assigneeId} onChange={setAssigneeId} placeholder={L('t_unassigned')}
              options={agentOptions} style={{ flex: 1 }} />
            <button className="btn sec sm" type="button" onClick={() => setAssigneeId(me?.id || '')}>{L('t_assign_me')}</button>
          </div>
        </Field>
        <Field wide label={L('t_reply')} hint={L('t_reply_ph')}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} />
        </Field>
        <Field wide label={L('t_internal_note')} hint={L('t_internal_note_ph')}>
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
        </Field>
      </FormGrid>
      {status === 'open' && t.status === 'closed' && <p className="note">{L('t_reopen_hint')}</p>}
    </Modal>
  );
}

function CorrectionDialog({ correction, question, ctx, busy, isAdmin, onClose, onResolve }) {
  const { L } = ctx;
  const [resolution, setResolution] = useState('confirmed');
  const [fix, setFix] = useState(false);
  const [statement, setStatement] = useState(question?.statement || '');
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [note, setNote] = useState('');

  const submit = () => {
    const body = { resolution };
    if (note.trim()) body.note = note.trim();
    // El backend solo aplica questionPatch cuando la resolución es 'confirmed'.
    if (resolution === 'confirmed' && fix) {
      const patch = {};
      if (statement.trim() && statement !== question?.statement) patch.statement = statement.trim();
      if (correctAnswer.trim() && correctAnswer !== question?.correctAnswer) patch.correctAnswer = correctAnswer.trim().toUpperCase();
      if (explanation !== (question?.explanation || '')) patch.explanation = explanation;
      if (Object.keys(patch).length) body.questionPatch = patch;
    }
    onResolve(body);
  };

  return (
    <Modal wide busy={busy} title={L('co_resolve')} subtitle={correction.id} onClose={onClose}
      footer={<>
        <button className="btn sec" onClick={onClose} disabled={busy}>{L('cancel')}</button>
        <button className={`btn ${resolution === 'rejected' ? 'dgr' : ''}`} onClick={submit} disabled={busy}>
          {busy ? '…' : L(resolution === 'confirmed' ? 'co_confirm' : 'co_reject', { n: CONFIRM_REWARD })}
        </button>
      </>}>
      <Card className="flat">
        <KV k={L('co_user')} v={correction.userName || correction.userId} />
        <KV k={L('co_reason')} v={L(`reason_${correction.reason}`)} />
        <KV k={L('co_comment')} v={correction.comment} />
        <KV k={L('co_proposed_answer')} v={correction.proposedAnswer || L('none')} />
        <KV k={L('co_question')} v={correction.questionId} />
      </Card>

      {question ? (
        <>
          <div className="section-label">{L('co_question')}</div>
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>{question.statement}</p>
          <div className="chips" style={{ marginTop: 8 }}>
            {(question.options || []).map((o, i) => (
              <span key={i} className={`chip ${'ABCDEF'[i] === question.correctAnswer ? 'on' : ''}`}>{'ABCDEF'[i]}. {o}</span>
            ))}
          </div>
        </>
      ) : correction.questionStatement ? (
        <>
          <div className="section-label">{L('co_question')}</div>
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>{correction.questionStatement}</p>
        </>
      ) : null}
      {!question && !isAdmin && <p className="note" style={{ marginTop: 10 }}>ℹ️ {L('co_needs_admin')}</p>}

      <div className="section-label">{L('co_resolution')}</div>
      <div className="chips">
        <button type="button" className={`chip ${resolution === 'confirmed' ? 'on' : ''}`} onClick={() => setResolution('confirmed')}>
          ✓ {L('co_confirm', { n: CONFIRM_REWARD })}
        </button>
        <button type="button" className={`chip ${resolution === 'rejected' ? 'on' : ''}`} onClick={() => setResolution('rejected')}>
          ✕ {L('co_reject')}
        </button>
      </div>

      {resolution === 'confirmed' && question && (
        <>
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)} />
            <span>{L('co_fix_question')}</span>
          </label>
          <div className="note" style={{ marginBottom: 8 }}>{L('co_fix_hint')}</div>
          {fix && (
            <FormGrid>
              <Field wide label={L('q_statement')}><textarea value={statement} onChange={(e) => setStatement(e.target.value)} /></Field>
              <Field label={L('q_correct')}><input value={correctAnswer} maxLength={1} onChange={(e) => setCorrectAnswer(e.target.value)} /></Field>
              <Field wide label={L('q_explanation')}><textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></Field>
            </FormGrid>
          )}
        </>
      )}

      <FormGrid>
        <Field wide label={L('co_note')} hint={L('co_note_ph')}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormGrid>
    </Modal>
  );
}

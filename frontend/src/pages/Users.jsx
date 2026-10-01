import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  TopKpiCard, Card, Loading, ErrorBox, EmptyState, Modal, Field, FormGrid, Select,
  Tabs, Toast, useToast, KV, Pill, Pager,
  IconUsers, IconCheckCircle, IconBan, IconTicket, IconFlag, IconInfo, IconMedal,
} from '../components/ui.jsx';

const USER_STATES = ['active', 'suspended', 'churned'];
const STATE_TAG = { active: ['g', 'us_active'], suspended: ['w', 'us_suspended'], churned: ['d', 'us_churned'] };
const PRI_TAG = { high: ['d', 'pri_high'], med: ['w', 'pri_med'], low: ['b', 'pri_low'] };
const TICKET_TAG = { open: ['d', 'ts_open'], progress: ['w', 'ts_progress'], closed: ['g', 'ts_closed'] };
const COR_TAG = { pending: ['w', 'cs_pending'], confirmed: ['g', 'cs_confirmed'], rejected: ['d', 'cs_rejected'] };

const TICKET_CATEGORIES = ['account', 'payments', 'content', 'login', 'other'];
const REASON_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'incorrect_answer', label: 'Respuesta incorrecta' },
  { value: 'typo', label: 'Error de tipeo' },
  { value: 'ambiguous_statement', label: 'Enunciado ambiguo' },
  { value: 'poor_explanation', label: 'Explicación deficiente' },
  { value: 'incomplete_answer', label: 'Respuesta incompleta' },
];

const CONFIRM_REWARD = 250;
const FALLBACK_PLANS = [{ id: 'free', name: 'Gratis' }, { id: 'uni', name: '1 prueba' }, { id: 'all', name: 'Todas' }];
const FALLBACK_AGENTS = [{ id: 'adm_1', name: 'Admin General', role: 'admin' }, { id: 'adm_4', name: 'Soporte', role: 'support' }];

const PAGE_SIZE = 20;
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const tr = (L, key, fallback) => {
  const val = L?.(key);
  return val && val !== key ? val : fallback;
};

// Normalizador de texto: sin tildes, sin signos de puntuación y en minúsculas
const cleanText = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,:;'"()\-–—_+*/\\=[\]{}#]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const formatDateTime = (dateStr, lang = 'es') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (dateStr, lang = 'es') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US');
};

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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const SvgAward = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);
const SvgCalendar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  // ── usuarios ──
  const [uFilters, setUFilters] = useState({ q: '', plan: '', state: '' });
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState([null]);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState(null);
  const [uTotal, setUTotal] = useState(0);
  const [uNext, setUNext] = useState(null);
  const [uErr, setUErr] = useState(null);
  const [uStats, setUStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSubTab, setUserSubTab] = useState('summary');

  // ── tickets ──
  const [allTickets, setAllTickets] = useState(null);
  const [tFilters, setTFilters] = useState({ q: '', status: '', priority: '', category: '', date: '' });
  const [tErr, setTErr] = useState(null);

  // ── recorrecciones ──
  const [cFilters, setCFilters] = useState({ status: '' });
  const [cReason, setCReason] = useState('');
  const [cDate, setCDate] = useState('');
  const [cSearch, setCSearch] = useState('');
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
    try { setUStats((await api.get('/users/stats')).data); } catch { /* noop */ }
  }, []);

  const loadUsers = useCallback(async (f, cursor) => {
    setUErr(null);
    try {
      const r = await api.get(`/users${qs({ ...f, limit: PAGE_SIZE, cursor })}`);
      setUsers(r.data);
      setUTotal(r.meta?.pagination?.total ?? r.data.length);
      setUNext(r.meta?.pagination?.nextCursor ?? null);
      setSelectedUser((prev) => (prev ? r.data.find((u) => u.id === prev.id) || prev : null));
    } catch (e) { setUErr(e.message); }
  }, []);

  const loadTickets = useCallback(async () => {
    setTErr(null);
    try {
      const r = await api.get('/tickets');
      setAllTickets(r.data || []);
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

  useEffect(() => { api.get('/plans').then((r) => setPlans(r.data)).catch(() => setPlans(null)); }, []);
  useEffect(() => { api.get('/agents').then((r) => setAgents(r.data)).catch(() => setAgents(null)); }, []);
  useEffect(() => { loadUserStats(); }, [loadUserStats]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => { setCursors([null]); setPage(0); loadUsers(uFilters, null); }, [uFilters, loadUsers]);
  // Se carga una sola vez (como loadTickets) y el filtro de estado (Pendientes/
  // Confirmadas/Rechazadas) se aplica en el cliente vía `filteredCorrections`.
  // Antes se volvía a pedir al servidor con `status` cada vez que se tocaba una
  // pestaña, así que `corrections` quedaba con solo esos registros y los
  // contadores de las OTRAS pestañas (calculados sobre `corrections`) caían a 0.
  useEffect(() => { loadCorrections({}); }, [loadCorrections]);

  useEffect(() => {
    const id = setTimeout(() => setUFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (tab !== 'corrections' || !isAdmin || questionsById) return;
    api.get('/questions')
      .then((r) => setQuestionsById(Object.fromEntries(r.data.map((q) => [q.id, q]))))
      .catch(() => setQuestionsById({}));
  }, [tab, isAdmin, questionsById]);

  const ticketCounts = useMemo(() => {
    const list = allTickets || [];
    return {
      total: list.length,
      open: list.filter((x) => x.status === 'open').length,
      progress: list.filter((x) => x.status === 'progress').length,
      closed: list.filter((x) => x.status === 'closed').length,
    };
  }, [allTickets]);

  const filteredTickets = useMemo(() => {
    if (!allTickets) return null;
    return allTickets.filter((tk) => {
      if (tFilters.status && tk.status !== tFilters.status) return false;
      if (tFilters.priority && tk.priority !== tFilters.priority) return false;
      if (tFilters.category && tk.category !== tFilters.category) return false;

      if (tFilters.q) {
        const queryTokens = cleanText(tFilters.q).split(' ').filter(Boolean);
        const searchable = cleanText(`${tk.subject || ''} ${tk.userName || tk.user || ''} ${tk.number ?? tk.id ?? ''}`);
        const matchesAllTokens = queryTokens.every((token) => searchable.includes(token));
        if (!matchesAllTokens) return false;
      }

      if (tFilters.date) {
        if (!tk.createdAt) return false;
        const d = new Date(tk.createdAt);
        if (isNaN(d.getTime())) return false;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDate = `${year}-${month}-${day}`;
        if (localDate !== tFilters.date) return false;
      }

      return true;
    });
  }, [allTickets, tFilters]);

  const correctionCounts = useMemo(() => {
    const list = corrections || [];
    return {
      all: list.length,
      pending: list.filter((c) => (c.status || 'pending') === 'pending').length,
      confirmed: list.filter((c) => c.status === 'confirmed').length,
      rejected: list.filter((c) => c.status === 'rejected').length,
    };
  }, [corrections]);

  // Búsqueda flexible de recorrecciones
  const filteredCorrections = useMemo(() => {
    if (!corrections) return null;
    return corrections.filter((c) => {
      if (cFilters.status && (c.status || 'pending') !== cFilters.status) return false;
      if (cReason && c.reason !== cReason) return false;

      if (cDate) {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        if (isNaN(d.getTime())) return false;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDate = `${year}-${month}-${day}`;
        if (localDate !== cDate) return false;
      }

      if (cSearch.trim()) {
        const queryTokens = cleanText(cSearch).split(' ').filter(Boolean);
        const qObj = questionsById?.[c.questionId];
        const stmt = qObj?.statement || c.questionStatement || '';
        const user = c.userName || c.userId || '';
        const qid = c.questionId || c.id || '';
        const comment = c.comment || '';

        const searchable = cleanText(`${stmt} ${user} ${qid} ${comment}`);
        const matchesAll = queryTokens.every((token) => searchable.includes(token));
        if (!matchesAll) return false;
      }

      return true;
    });
  }, [corrections, cFilters.status, cReason, cDate, cSearch, questionsById]);

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
      if ('state' in patch) loadUserStats();
    }
  };

  const patchTicket = async (tk, patch) => {
    if (await run(() => api.patch(`/tickets/${tk.id}`, patch), L('saved_ok'))) {
      loadTickets();
    }
  };

  const resolveCorrection = async (cor, body) => {
    const out = await run(() => api.patch(`/corrections/${cor.id}`, body));
    if (!out) return;
    const reward = out.data?.rewardGranted;
    t.ok(reward ? L('co_reward_granted', { n: reward.amount ?? CONFIRM_REWARD }) : L('co_rejected'));
    loadCorrections({});
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
        <TopKpiCard label={L('u_tickets')} value={fmt(ticketCounts.open)} icon={IconTicket} tone="blue" />
      </div>

      <div style={{ marginTop: 18 }}>
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: 'users', ic: <IconUsers size={14} />, label: L('tab_users'), count: uTotal },
          { id: 'tickets', ic: <IconTicket size={14} />, label: L('tab_tickets'), count: ticketCounts.open },
          { id: 'corrections', ic: <IconFlag size={14} />, label: L('tab_corrections'), count: pendingCor },
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
          {users?.length === 0 ? <EmptyState msg={L('u_no_users')} ic={<IconUsers size={22} />} /> : (
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
                    const own = (allTickets || []).filter((tk) => tk.userId === selectedUser.id || tk.userName === selectedUser.name);
                    return own.length === 0 ? <EmptyState msg={L('u_no_user_tickets')} ic={<IconTicket size={22} />} /> : own.map((tk) => (
                      <div key={tk.id} className="u-mini-row">
                        <div><b>#{tk.number ?? tk.id}</b> {tk.subject}</div>
                        <Pill value={tk.status} map={TICKET_TAG} L={L} />
                      </div>
                    ));
                  })()}

                  {userSubTab === 'corrections' && (() => {
                    const own = (corrections || []).filter((c) => c.userId === selectedUser.id || c.userName === selectedUser.name);
                    return own.length === 0 ? <EmptyState msg={L('u_no_user_corrections')} ic={<IconFlag size={22} />} /> : own.map((c) => (
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

      {/* ── TABLA DE TICKETS ── */}
      {tab === 'tickets' && (
        <Card className="tab-fade" style={{ padding: 24 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{tr(L, 't_support_title', 'Tickets de soporte')}</h2>
            <div style={{ position: 'relative', width: 280 }}>
              <input
                className="grow"
                style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
                placeholder={tr(L, 't_search_ph', 'Buscar tickets, usuarios o asuntos...')}
                value={tFilters.q}
                onChange={(e) => setTFilters((f) => ({ ...f, q: e.target.value }))}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <SvgSearch />
              </span>
            </div>
          </div>

          <div className="filters mb" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 12, alignItems: 'end' }}>
            <Field label={tr(L, 't_pri', 'Prioridad')}>
              <Select
                value={tFilters.priority}
                onChange={(v) => setTFilters((f) => ({ ...f, priority: v }))}
                options={[{ value: '', label: tr(L, 'filter_all', 'Todas') }, ...Object.keys(PRI_TAG).map((s) => ({ value: s, label: L(PRI_TAG[s][1]) }))]}
              />
            </Field>

            <Field label={tr(L, 't_category', 'Categoría')}>
              <Select
                value={tFilters.category}
                onChange={(v) => setTFilters((f) => ({ ...f, category: v }))}
                options={[{ value: '', label: tr(L, 'filter_all', 'Todas') }, ...TICKET_CATEGORIES.map((c) => ({ value: c, label: tr(L, `cat_${c}`, c) }))]}
              />
            </Field>

            <Field label={tr(L, 't_created_date', 'Fecha emitida')}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="date"
                  value={tFilters.date}
                  onChange={(e) => setTFilters((f) => ({ ...f, date: e.target.value }))}
                  style={{ fontSize: 13, width: '100%' }}
                />
                {tFilters.date && (
                  <button
                    type="button"
                    onClick={() => setTFilters((f) => ({ ...f, date: '' }))}
                    title="Quitar fecha"
                    style={{
                      position: 'absolute',
                      right: 28,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--muted)',
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </Field>

            <button
              className="btn sec sm"
              style={{ height: 38 }}
              onClick={() => setTFilters({ status: '', priority: '', category: '', q: '', date: '' })}
            >
              {tr(L, 'clear_filters', 'Limpiar filtros')}
            </button>
          </div>

          <div className="flex" style={{ gap: 8, margin: '18px 0 16px', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            {[
              { id: '', label: 'Todos', color: '#2563eb', count: ticketCounts.total },
              { id: 'open', label: 'Abiertos', color: '#ef4444', count: ticketCounts.open },
              { id: 'progress', label: 'En curso', color: '#f59e0b', count: ticketCounts.progress },
              { id: 'closed', label: 'Cerrados', color: '#10b981', count: ticketCounts.closed },
            ].map((tabItem) => {
              const active = tFilters.status === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setTFilters((f) => ({ ...f, status: tabItem.id }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? `2px solid ${tabItem.color}` : '2px solid transparent',
                    padding: '6px 12px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    color: active ? 'var(--ink)' : 'var(--muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tabItem.color }} />
                  {tabItem.label}
                  <span style={{ background: 'var(--soft)', color: 'var(--ink)', fontSize: 11, padding: '1px 6px', borderRadius: 10 }}>
                    {tabItem.count}
                  </span>
                </button>
              );
            })}
          </div>

          {tErr && <ErrorBox msg={tErr} onRetry={loadTickets} L={L} />}
          {!filteredTickets ? <Loading L={L} /> : filteredTickets.length === 0 ? <EmptyState msg={L('t_no_tickets')} ic={<IconTicket size={22} />} /> : (
            <div className="tbl-wrap pretty">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>{tr(L, 't_subj', 'Asunto')}</th>
                    <th>{tr(L, 't_user', 'Usuario')}</th>
                    <th>{tr(L, 't_category', 'Categoría')}</th>
                    <th>{tr(L, 't_pri', 'Prioridad')}</th>
                    <th>{tr(L, 't_state', 'Estado')}</th>
                    <th>{tr(L, 't_created_col', 'Fecha emitida')}</th>
                    <th style={{ textAlign: 'center', width: 60 }}>{tr(L, 't_actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((x) => (
                    <tr key={x.id}>
                      <td className="note">#{x.number ?? x.id}</td>
                      <td>
                        <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
                          <div className="avatar sm" style={{ background: '#1e293b', color: '#fff', fontSize: 11 }}>
                            {initials(x.userName || x.user)}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{x.subject}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{x.userName || x.user}</td>
                      <td className="note">{x.category ? tr(L, `cat_${x.category}`, x.category) : '—'}</td>
                      <td><Pill value={x.priority || 'med'} map={PRI_TAG} L={L} /></td>
                      <td><Pill value={x.status || 'open'} map={TICKET_TAG} L={L} /></td>
                      <td className="note">{formatDateOnly(x.createdAt, lang)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          title={tr(L, 't_manage', 'Gestionar')}
                          onClick={() => setDialog({ kind: 'ticket', ticket: x })}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, color: 'var(--muted)' }}
                        >
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── LISTA DE RECORRECCIONES (FILTROS SIN ESTADO REDUNDANTE) ── */}
      {tab === 'corrections' && (
        <Card className="tab-fade" style={{ padding: '24px 28px', borderRadius: 16 }}>
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Recorrecciones</h2>
            <div style={{ position: 'relative', width: 340 }}>
              <input
                type="text"
                className="grow"
                style={{ width: '100%', paddingLeft: 32, fontSize: 13 }}
                placeholder="Buscar por pregunta, alumno o ID..."
                value={cSearch}
                onChange={(e) => setCSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <SvgSearch />
              </span>
            </div>
          </div>

          {/* Filtros: Motivo, Fecha y Limpiar (sin el dropdown de Estado) */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 220px auto', gap: 14, alignItems: 'end', marginBottom: 20 }}>
            <Field label="Motivo">
              <Select
                value={cReason}
                onChange={setCReason}
                options={REASON_OPTIONS}
              />
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
                style={{ height: 38, fontSize: 13, borderRadius: 8, border: '1px solid var(--line)', padding: '0 10px', width: '100%' }}
              />
            </Field>

            <button
              className="btn sec sm"
              style={{ height: 38, alignSelf: 'end' }}
              onClick={() => {
                setCSearch('');
                setCReason('');
                setCDate('');
                setCFilters({ status: '' });
              }}
            >
              Limpiar filtros
            </button>
          </div>

          {/* Pestañas de estado con contadores en píldora */}
          <div className="flex" style={{ gap: 14, borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
            {[
              { id: '', label: 'Todos', count: correctionCounts.all, dotColor: '#3b82f6' },
              { id: 'pending', label: 'Pendientes', count: correctionCounts.pending, dotColor: '#f59e0b' },
              { id: 'confirmed', label: 'Confirmadas', count: correctionCounts.confirmed, dotColor: '#10b981' },
              { id: 'rejected', label: 'Rechazadas', count: correctionCounts.rejected, dotColor: '#ef4444' },
            ].map((tabItem) => {
              const active = (cFilters.status || '') === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setCFilters((f) => ({ ...f, status: tabItem.id }))}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderBottom: active ? `2px solid ${tabItem.dotColor}` : '2px solid transparent',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--ink)' : 'var(--muted)',
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tabItem.dotColor }} />
                  {tabItem.label}
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '1px 7px',
                    borderRadius: 12,
                    background: active ? '#eff6ff' : 'var(--soft, #f1f5f9)',
                    color: active ? '#2563eb' : 'var(--muted)',
                  }}>
                    {tabItem.count}
                  </span>
                </button>
              );
            })}
          </div>

          {!isAdmin && (
            <p className="note" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <IconInfo size={14} /> {L('co_needs_admin')}
            </p>
          )}
          {cErr && <ErrorBox msg={cErr} onRetry={() => loadCorrections({})} L={L} />}

          {!filteredCorrections ? (
            <Loading L={L} />
          ) : filteredCorrections.length === 0 ? (
            <EmptyState msg={L('co_no_items')} ic={<IconFlag size={22} />} />
          ) : (
            <div className="tbl-wrap pretty">
              <table>
                <thead>
                  <tr style={{ color: 'var(--muted)', fontSize: 12 }}>
                    <th style={{ width: 90 }}>#</th>
                    <th>Pregunta</th>
                    <th>Alumno</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Recibido</th>
                    <th style={{ textAlign: 'center', width: 110 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCorrections.map((c) => {
                    const q = questionsById?.[c.questionId];
                    const isPending = (c.status || 'pending') === 'pending';
                    const dateText = c.createdAt ? new Date(c.createdAt).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : '—';

                    return (
                      <tr key={c.id} style={{ fontSize: 13 }}>
                        <td className="note" style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                          {c.questionId || c.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {q?.statement || c.questionStatement || c.questionId}
                          </div>
                        </td>
                        <td style={{ color: 'var(--ink)' }}>{c.userName || c.userId}</td>
                        <td className="note">{L(`reason_${c.reason}`) || c.reason}</td>
                        <td>
                          <Pill value={c.status || 'pending'} map={COR_TAG} L={L} />
                        </td>
                        <td className="note">{dateText}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`btn sm ${isPending ? '' : 'sec'}`}
                            onClick={() => setDialog({ kind: 'correction', correction: c, question: q })}
                            style={{ padding: '4px 14px', fontSize: 12, borderRadius: 6 }}
                          >
                            {isPending ? 'Resolver' : 'Ver'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
              <KV k={L('u_badges')} v={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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

// ── DIÁLOGO GESTIONAR TICKET ──
function TicketDialog({ ticket, ctx, busy, me, agentOptions, onClose, onSave }) {
  const { L, lang } = ctx;
  const [detail, setDetail] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [dialogTab, setDialogTab] = useState('conversation');

  const [subject, setSubject] = useState(ticket.subject || '');
  const [category, setCategory] = useState(ticket.category || 'account');
  const [status, setStatus] = useState(ticket.status || 'open');
  const [priority, setPriority] = useState(ticket.priority || 'med');
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId || '');

  const [reply, setReply] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const r = await api.get(`/tickets/${ticket.id}`);
      setDetail(r.data);
      if (r.data.subject) setSubject(r.data.subject);
      if (r.data.category) setCategory(r.data.category);
    } catch (e) {
      setLoadErr(e.message);
    }
  }, [ticket.id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const t = detail || ticket;

  const handleSendMessage = async () => {
    const text = reply.trim();
    if (!text || sendingMsg) return;

    setSendingMsg(true);
    try {
      await api.patch(`/tickets/${t.id}`, { reply: text });
      setReply('');
      await fetchDetail();
    } catch (e) {
      alert(e.message);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const submitMeta = () => {
    const patch = {};
    if (subject.trim() !== (t.subject || '')) patch.subject = subject.trim();
    if (category !== (t.category || '')) patch.category = category;
    if (status !== (t.status || 'open')) patch.status = status;
    if (priority !== (t.priority || 'med')) patch.priority = priority;
    if (assigneeId !== (t.assigneeId || '')) patch.assigneeId = assigneeId || null;

    if (!Object.keys(patch).length) { onClose(); return; }
    onSave(patch);
  };

  return (
    <Modal
      wide
      busy={busy}
      title="Gestionar ticket"
      subtitle={`#${t.number ?? t.id} · ${t.userName || t.user}`}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.35fr', gap: 24, minHeight: 500 }}>
        {/* Columna Izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderRight: '1px solid var(--line)', paddingRight: 20 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            background: 'var(--soft)',
            borderRadius: 8,
            border: '1px solid var(--line)'
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: '#1e293b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0
            }}>
              {initials(t.userName || t.user)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.userName || t.user}
              </div>
              <div className="note" style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.userEmail || t.email || 'Sin correo asociado'}
              </div>
            </div>
            {t.channel && (
              <span className="tag" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                {tr(L, `chan_${t.channel}`, t.channel)}
              </span>
            )}
          </div>

          <Field label="Asunto *">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del ticket"
            />
          </Field>

          <Field label="Categoría *">
            <Select
              value={category}
              onChange={setCategory}
              options={TICKET_CATEGORIES.map((c) => ({ value: c, label: tr(L, `cat_${c}`, c === 'account' ? 'Cuenta' : c) }))}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Estado">
              <Select
                value={status}
                onChange={setStatus}
                options={Object.keys(TICKET_TAG).map((s) => ({ value: s, label: L(TICKET_TAG[s][1]) }))}
              />
            </Field>
            <Field label="Prioridad">
              <Select
                value={priority}
                onChange={setPriority}
                options={Object.keys(PRI_TAG).map((s) => ({ value: s, label: L(PRI_TAG[s][1]) }))}
              />
            </Field>
          </div>

          <Field label="Asignado a">
            <div className="flex" style={{ gap: 8 }}>
              <Select
                value={assigneeId}
                onChange={setAssigneeId}
                placeholder="Sin asignar"
                options={agentOptions}
                style={{ flex: 1 }}
              />
              <button
                className="btn sec sm"
                type="button"
                onClick={() => setAssigneeId(me?.id || '')}
                style={{ whiteSpace: 'nowrap' }}
              >
                Asignarme
              </button>
            </div>
          </Field>

          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 16 }}>
            <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
              <SvgClock />
              <div>
                <div className="note" style={{ fontSize: 11 }}>Fecha emitida</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{formatDateTime(t.createdAt, lang)}</div>
              </div>
            </div>
            <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
              <SvgCalendar />
              <div>
                <div className="note" style={{ fontSize: 11 }}>Cerrado</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {t.closedAt ? formatDateTime(t.closedAt, lang) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex" style={{ gap: 16, borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setDialogTab('conversation')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: dialogTab === 'conversation' ? '2px solid #2563eb' : '2px solid transparent',
                paddingBottom: 6,
                fontWeight: dialogTab === 'conversation' ? 700 : 500,
                color: dialogTab === 'conversation' ? '#2563eb' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Conversación
            </button>
            <button
              type="button"
              onClick={() => setDialogTab('info')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: dialogTab === 'info' ? '2px solid #2563eb' : '2px solid transparent',
                paddingBottom: 6,
                fontWeight: dialogTab === 'info' ? 700 : 500,
                color: dialogTab === 'info' ? '#2563eb' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Información adicional
            </button>
          </div>

          {dialogTab === 'conversation' ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ flex: 1, maxHeight: 270, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 6 }}>
                {loadErr && <ErrorBox msg={loadErr} L={L} />}
                {!detail && !loadErr ? (
                  <Loading L={L} />
                ) : (t.messages || []).length === 0 ? (
                  <p className="note" style={{ textAlign: 'center', marginTop: 40 }}>Sin mensajes registrados</p>
                ) : (
                  (t.messages || []).map((m) => {
                    const isStaff = m.authorType === 'agent' || m.authorType === 'admin';

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: isStaff ? 'row-reverse' : 'row',
                          alignItems: 'flex-start',
                          gap: 10,
                          maxWidth: '90%',
                          alignSelf: isStaff ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            background: isStaff ? 'var(--brand)' : 'var(--chat-user-border)',
                            color: isStaff ? '#ffffff' : 'var(--chat-user-name)',
                          }}
                        >
                          {initials(m.authorName || (isStaff ? 'AD' : t.userName))}
                        </div>

                        <div
                          style={{
                            background: isStaff ? 'var(--chat-staff-bg)' : 'var(--chat-user-bg)',
                            border: `1px solid ${isStaff ? 'var(--chat-staff-border)' : 'var(--chat-user-border)'}`,
                            borderRadius: isStaff ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            padding: '9px 13px',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: isStaff ? 'var(--chat-staff-name)' : 'var(--chat-user-name)' }}>
                              {m.authorName}
                            </span>
                            <span className="note" style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                              {formatDateTime(m.createdAt, lang)}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--chat-body)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {m.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <Field
                  label="Respuesta al alumno"
                  hint={sendingMsg ? 'Enviando mensaje…' : 'Presiona Enter para enviar (Shift + Enter para salto de línea)'}
                >
                  <textarea
                    rows={3}
                    placeholder="Escribe una respuesta y presiona Enter..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sendingMsg}
                    style={{ width: '100%', resize: 'none' }}
                  />
                </Field>
              </div>

              <div className="flex" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn sec" onClick={onClose} disabled={busy || sendingMsg}>
                  Cancelar
                </button>
                <button type="button" className="btn" onClick={submitMeta} disabled={busy || sendingMsg}>
                  {busy ? '…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12 }}>
              <KV k="Email" v={t.userEmail || t.email || '—'} />
              <KV k="Canal" v={t.channel ? tr(L, `chan_${t.channel}`, t.channel) : 'Web'} />
              <KV k="Fecha emitida" v={formatDateTime(t.createdAt, lang)} />
              <KV k="ID Alumno" v={t.userId || '—'} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── DIÁLOGO RESOLVER RECORRECCIÓN ──
function CorrectionDialog({ correction, question, ctx, busy, isAdmin, onClose, onResolve }) {
  const { L } = ctx;
  const [resolution, setResolution] = useState('confirmed');
  const [fix, setFix] = useState(false);
  const [statement, setStatement] = useState(question?.statement || '');
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [note, setNote] = useState('');

  const isReadOnly = (correction.status && correction.status !== 'pending');
  const options = question?.options || [];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  const availableOptionItems = useMemo(() => {
    if (options.length > 0) {
      return options.map((opt, i) => ({
        letter: letters[i],
        label: `${letters[i]} · ${opt.length > 42 ? opt.substring(0, 42) + '…' : opt}`,
        text: opt,
      }));
    }
    return ['A', 'B', 'C', 'D', 'E'].map((l) => ({ letter: l, label: `Alternativa ${l}`, text: '' }));
  }, [options]);

  const selectOptions = useMemo(() => {
    return availableOptionItems.map((item) => ({
      value: item.letter,
      label: item.label,
    }));
  }, [availableOptionItems]);

  const proposedClean = (correction.proposedAnswer || '').trim().toUpperCase();
  const isProposedValid = availableOptionItems.some((opt) => opt.letter === proposedClean);

  const submit = () => {
    const body = { resolution };
    if (note.trim()) body.note = note.trim();
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
    <Modal
      wide
      busy={busy}
      title="Resolver solicitud"
      subtitle={`${correction.questionId || correction.id} · ${correction.userName || correction.userId}`}
      onClose={onClose}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, alignItems: 'start' }}>
        {/* Columna Izquierda: Contexto pregunta y propuesta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, borderRight: '1px solid var(--line)', paddingRight: 24 }}>
          <div>
            <div className="section-label tight" style={{ letterSpacing: '0.05em', color: 'var(--muted)', fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              PREGUNTA
            </div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.45 }}>
              {question?.statement || correction.questionStatement || correction.questionId}
            </p>
          </div>

          {options.length > 0 && (
            <div>
              <div className="note" style={{ fontSize: 11.5, marginBottom: 6 }}>Alternativas (resaltada la correcta actual):</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {options.map((optText, i) => {
                  const letter = letters[i];
                  const isCurrentCorrect = question?.correctAnswer === letter;
                  return (
                    <div
                      key={letter}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 18,
                        fontSize: 12.5,
                        fontWeight: isCurrentCorrect ? 700 : 500,
                        background: isCurrentCorrect ? '#1d4ed8' : '#f1f5f9',
                        color: isCurrentCorrect ? '#ffffff' : 'var(--ink)',
                        border: isCurrentCorrect ? '1px solid #1d4ed8' : '1px solid var(--line)',
                      }}
                    >
                      <span style={{ fontWeight: 800 }}>{letter}.</span>
                      <span>{optText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="section-label tight" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Respuesta propuesta por el alumno
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{correction.proposedAnswer || 'No especificada'}</span>
              {isProposedValid && (
                <span className="tag" style={{ background: '#dbeafe', color: '#1e40af', fontSize: 11 }}>Opción {proposedClean}</span>
              )}
            </div>
          </div>

          <div>
            <div className="section-label tight" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Comentario del alumno
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--ink)',
              minHeight: 64,
              whiteSpace: 'pre-wrap',
            }}>
              {correction.comment || 'Sin comentarios adicionales.'}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Decisión y corrección con selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-label tight" style={{ letterSpacing: '0.05em', color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
            DECISIÓN
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              onClick={() => !isReadOnly && setResolution('confirmed')}
              style={{
                cursor: isReadOnly ? 'default' : 'pointer',
                borderRadius: 12,
                padding: '12px 14px',
                border: resolution === 'confirmed' ? '2px solid #10b981' : '1px solid var(--line)',
                background: resolution === 'confirmed' ? '#f0fdf4' : '#fff',
                transition: 'all 0.15s ease',
              }}
            >
              <div className="flex" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#10b981', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold'
                }}>✓</span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#065f46' }}>Confirmar</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#047857' }}>El alumno recibe 250 badges</div>
            </div>

            <div
              onClick={() => !isReadOnly && setResolution('rejected')}
              style={{
                cursor: isReadOnly ? 'default' : 'pointer',
                borderRadius: 12,
                padding: '12px 14px',
                border: resolution === 'rejected' ? '2px solid #ef4444' : '1px solid var(--line)',
                background: resolution === 'rejected' ? '#fef2f2' : '#fff',
                transition: 'all 0.15s ease',
              }}
            >
              <div className="flex" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold'
                }}>✕</span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#991b1b' }}>Rechazar</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#b91c1c' }}>No se otorgan badges</div>
            </div>
          </div>

          {resolution === 'confirmed' && question && (
            <div style={{ marginTop: 6 }}>
              <label className="check" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={fix}
                  onChange={(e) => setFix(e.target.checked)}
                  disabled={isReadOnly}
                />
                <span>Corregir la pregunta al confirmar</span>
              </label>
              <div className="note" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginLeft: 24 }}>
                Opcional. Se envía como questionPatch y solo se aplica si confirmas.
              </div>

              {fix && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--soft)', padding: 14, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <Field label="Enunciado">
                    <textarea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
                  </Field>

                  {/* Selector de alternativas seguras */}
                  <Field label="Alternativa correcta">
                    <Select
                      value={correctAnswer}
                      onChange={setCorrectAnswer}
                      options={selectOptions}
                      placeholder="Seleccionar alternativa correcta..."
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {availableOptionItems.map((item) => {
                        const isChosen = correctAnswer === item.letter;
                        return (
                          <button
                            key={item.letter}
                            type="button"
                            onClick={() => setCorrectAnswer(item.letter)}
                            style={{
                              flex: 1,
                              padding: '5px 0',
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 6,
                              border: isChosen ? '2px solid #2563eb' : '1px solid var(--line)',
                              background: isChosen ? '#2563eb' : '#fff',
                              color: isChosen ? '#fff' : 'var(--ink)',
                              cursor: 'pointer',
                            }}
                          >
                            {item.letter}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Explicación">
                    <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 6 }}>
            <Field label="Nota del revisor (opcional)">
              <textarea
                rows={3}
                placeholder="Escribe una nota interna o respuesta..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isReadOnly}
                style={{ width: '100%', fontSize: 13 }}
              />
            </Field>
            <div className="note" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              El alumno la verá en la notificación de resolución.
            </div>
          </div>

          <div className="flex" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn sec" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            {!isReadOnly && (
              <button
                type="button"
                className={`btn ${resolution === 'rejected' ? 'dgr' : ''}`}
                onClick={submit}
                disabled={busy}
              >
                {busy ? '…' : 'Confirmar resolución'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
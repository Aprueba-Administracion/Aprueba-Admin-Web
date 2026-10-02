import { CONFIRM_REWARD, FALLBACK_PLANS, FALLBACK_AGENTS, PAGE_SIZE, cleanText } from "./users/shared.jsx";
import UsersPanel from './users/UsersPanel.jsx';
import TicketsPanel from './users/TicketsPanel.jsx';
import CorrectionsPanel from './users/CorrectionsPanel.jsx';
import UserDialog from './users/UserDialog.jsx';
import TicketDialog from './users/TicketDialog.jsx';
import CorrectionDialog from './users/CorrectionDialog.jsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { TopKpiCard, Loading, Tabs, Toast, useToast, IconUsers, IconCheckCircle, IconBan, IconTicket, IconFlag } from "../components/ui.jsx";

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

      <div className="users-layout-1" >
        <Tabs active={tab} onChange={setTab} tabs={[
          { id: 'users', ic: <IconUsers size={14} />, label: L('tab_users'), count: uTotal },
          { id: 'tickets', ic: <IconTicket size={14} />, label: L('tab_tickets'), count: ticketCounts.open },
          { id: 'corrections', ic: <IconFlag size={14} />, label: L('tab_corrections'), count: pendingCor },
        ]} />
      </div>

      {tab === 'users' && (
        <UsersPanel L={L} search={search} setSearch={setSearch} uFilters={uFilters} setUFilters={setUFilters} planOptions={planOptions} uErr={uErr} loadUsers={loadUsers} cursors={cursors} page={page} users={users} selectedUser={selectedUser} setSelectedUser={setSelectedUser} setUserSubTab={setUserSubTab} uTotal={uTotal} uNext={uNext} goNext={goNext} goPrev={goPrev} openUser={openUser} busy={busy} patchUser={patchUser} userSubTab={userSubTab} planName={planName} fmt={fmt} lang={lang} allTickets={allTickets} corrections={corrections} />
      )}

      {/* ── TABLA DE TICKETS ── */}
      {tab === 'tickets' && (
        <TicketsPanel L={L} tFilters={tFilters} setTFilters={setTFilters} ticketCounts={ticketCounts} tErr={tErr} loadTickets={loadTickets} filteredTickets={filteredTickets} lang={lang} setDialog={setDialog} />
      )}

      {/* ── LISTA DE RECORRECCIONES (FILTROS SIN ESTADO REDUNDANTE) ── */}
      {tab === 'corrections' && (
        <CorrectionsPanel cSearch={cSearch} setCSearch={setCSearch} cReason={cReason} setCReason={setCReason} cDate={cDate} setCDate={setCDate} setCFilters={setCFilters} correctionCounts={correctionCounts} cFilters={cFilters} isAdmin={isAdmin} L={L} cErr={cErr} loadCorrections={loadCorrections} filteredCorrections={filteredCorrections} questionsById={questionsById} lang={lang} setDialog={setDialog} />
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

// ── DIÁLOGO GESTIONAR TICKET ──

// ── DIÁLOGO RESOLVER RECORRECCIÓN ──

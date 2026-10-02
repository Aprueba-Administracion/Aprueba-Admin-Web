import { Card, ErrorBox, EmptyState, Select, Pill, Pager, IconUsers, IconTicket, IconFlag } from "../../components/ui.jsx";
import { USER_STATES, STATE_TAG, TICKET_TAG, COR_TAG, initials, SvgSearch, SvgEdit, SvgCreditCard, SvgClock, SvgAward, SvgCalendar } from "./shared.jsx";

export default function UsersPanel({ L, search, setSearch, uFilters, setUFilters, planOptions, uErr, loadUsers, cursors, page, users, selectedUser, setSelectedUser, setUserSubTab, uTotal, uNext, goNext, goPrev, openUser, busy, patchUser, userSubTab, planName, fmt, lang, allTickets, corrections }) {
  return (
<Card className="tab-fade">
          <div className="filters mb">
            <div className="users-panel-layout-1" >
              <input className="grow users-panel-layout-2"  placeholder={L('u_search')}
                value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="users-panel-layout-3" >
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
            <div className="u-split users-panel-layout-4" style={{ "--users-panel-layout-4-grid-template-columns": ((value) => typeof value === 'number' ? value + 'px' : value)(selectedUser ? '460px 1fr' : '1fr') }}>
              <div className="u-list">
                <div className="u-rows">
                  {(users || []).map((x) => {
                    const isSel = selectedUser?.id === x.id;
                    return (
                      <div key={x.id} className={`u-row ${isSel ? 'sel' : ''}`}>
                        <div className="flex users-panel-layout-5" >
                          <div className="avatar">{initials(x.name)}</div>
                          <div className="users-panel-layout-6" >
                            <div className="users-panel-layout-7" >{x.name}</div>
                            <div className="note users-panel-layout-8" >{x.email}</div>
                          </div>
                        </div>
                        <Pill value={x.state} map={STATE_TAG} L={L} />
                        <button type="button" className={(`btn sm ${isSel ? '' : 'sec'}` || '') + ' users-panel-layout-9'}
                          onClick={() => { setSelectedUser(isSel ? null : x); setUserSubTab('summary'); }}
                          >
                          {isSel ? L('u_close_detail') : L('u_view_detail')}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="users-panel-layout-10" >
                  <Pager page={page} shown={users?.length || 0} total={uTotal} hasNext={!!uNext} onNext={goNext} onPrev={goPrev} L={L} />
                </div>
              </div>

              {selectedUser && (
                <div className="u-detail">
                  <div className="flex users-panel-layout-11" >
                    <div className="flex users-panel-layout-12" >
                      <div className="avatar lg">{initials(selectedUser.name)}</div>
                      <div>
                        <div className="flex users-panel-layout-13" >
                          <h2 className="users-panel-layout-14" >{selectedUser.name}</h2>
                          <Pill value={selectedUser.state} map={STATE_TAG} L={L} />
                        </div>
                        <span className="note">{selectedUser.email}</span>
                      </div>
                    </div>
                    <div className="flex users-panel-layout-15" >
                      <button type="button" className="btn sec sm users-panel-layout-16" onClick={() => openUser(selectedUser)}
                        >
                        <SvgEdit /><span>{L('edit')}</span>
                      </button>
                      <button type="button" className="btn sec sm" disabled={busy}
                        onClick={() => patchUser(selectedUser, { state: selectedUser.state === 'suspended' ? 'active' : 'suspended', reason: 'Acción rápida desde consola' })}>
                        {selectedUser.state === 'suspended' ? L('u_reactivate') : L('u_suspend')}
                      </button>
                      <button className="users-panel-layout-17" type="button" onClick={() => setSelectedUser(null)} title={L('u_close_detail')}
                        >
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
                    <p className="note users-panel-layout-18" >{L('u_no_activity')}</p>
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
  );
}

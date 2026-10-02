import { Card, Loading, ErrorBox, EmptyState, Field, Select, Pill, IconTicket } from "../../components/ui.jsx";
import { PRI_TAG, TICKET_TAG, TICKET_CATEGORIES, initials, tr, formatDateOnly, SvgSearch } from "./shared.jsx";

export default function TicketsPanel({ L, tFilters, setTFilters, ticketCounts, tErr, loadTickets, filteredTickets, lang, setDialog }) {
  return (
<Card className="tab-fade tickets-panel-layout-1" >
          <div className="flex tickets-panel-layout-2" >
            <h2 className="tickets-panel-layout-3" >{tr(L, 't_support_title', 'Tickets de soporte')}</h2>
            <div className="tickets-panel-layout-4" >
              <input
                className="grow tickets-panel-layout-5"
                
                placeholder={tr(L, 't_search_ph', 'Buscar tickets, usuarios o asuntos...')}
                value={tFilters.q}
                onChange={(e) => setTFilters((f) => ({ ...f, q: e.target.value }))}
              />
              <span className="tickets-panel-layout-6" >
                <SvgSearch />
              </span>
            </div>
          </div>

          <div className="filters mb tickets-panel-layout-7" >
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
              <div className="tickets-panel-layout-8" >
                <input className="tickets-panel-layout-9"
                  type="date"
                  value={tFilters.date}
                  onChange={(e) => setTFilters((f) => ({ ...f, date: e.target.value }))}
                  
                />
                {tFilters.date && (
                  <button className="tickets-panel-layout-10"
                    type="button"
                    onClick={() => setTFilters((f) => ({ ...f, date: '' }))}
                    title="Quitar fecha"
                    
                  >
                    ✕
                  </button>
                )}
              </div>
            </Field>

            <button
              className="btn sec sm tickets-panel-layout-11"
              
              onClick={() => setTFilters({ status: '', priority: '', category: '', q: '', date: '' })}
            >
              {tr(L, 'clear_filters', 'Limpiar filtros')}
            </button>
          </div>

          <div className="flex tickets-panel-layout-12" >
            {[
              { id: '', label: 'Todos', color: '#2563eb', count: ticketCounts.total },
              { id: 'open', label: 'Abiertos', color: '#ef4444', count: ticketCounts.open },
              { id: 'progress', label: 'En curso', color: '#f59e0b', count: ticketCounts.progress },
              { id: 'closed', label: 'Cerrados', color: '#10b981', count: ticketCounts.closed },
            ].map((tabItem) => {
              const active = tFilters.status === tabItem.id;
              return (
                <button className="tickets-panel-layout-13"
                  key={tabItem.id}
                  type="button"
                  onClick={() => setTFilters((f) => ({ ...f, status: tabItem.id }))}
                  style={{ "--tickets-panel-layout-13-border-bottom": ((value) => typeof value === 'number' ? value + 'px' : value)(active ? `2px solid ${tabItem.color}` : '2px solid transparent'), "--tickets-panel-layout-13-font-weight": active ? 700 : 500, "--tickets-panel-layout-13-color": ((value) => typeof value === 'number' ? value + 'px' : value)(active ? 'var(--ink)' : 'var(--muted)') }}
                >
                  <span className="tickets-panel-layout-14" style={{ "--tickets-panel-layout-14-background": ((value) => typeof value === 'number' ? value + 'px' : value)(tabItem.color) }} />
                  {tabItem.label}
                  <span className="tickets-panel-layout-15" >
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
                    <th className="tickets-panel-layout-16" >#</th>
                    <th>{tr(L, 't_subj', 'Asunto')}</th>
                    <th>{tr(L, 't_user', 'Usuario')}</th>
                    <th>{tr(L, 't_category', 'Categoría')}</th>
                    <th>{tr(L, 't_pri', 'Prioridad')}</th>
                    <th>{tr(L, 't_state', 'Estado')}</th>
                    <th>{tr(L, 't_created_col', 'Fecha emitida')}</th>
                    <th className="tickets-panel-layout-17" >{tr(L, 't_actions', 'Acciones')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((x) => (
                    <tr key={x.id}>
                      <td className="note">#{x.number ?? x.id}</td>
                      <td>
                        <div className="flex tickets-panel-layout-18" >
                          <div className="avatar sm tickets-panel-layout-19" >
                            {initials(x.userName || x.user)}
                          </div>
                          <span className="tickets-panel-layout-20" >{x.subject}</span>
                        </div>
                      </td>
                      <td className="tickets-panel-layout-21" >{x.userName || x.user}</td>
                      <td className="note">{x.category ? tr(L, `cat_${x.category}`, x.category) : '—'}</td>
                      <td><Pill value={x.priority || 'med'} map={PRI_TAG} L={L} /></td>
                      <td><Pill value={x.status || 'open'} map={TICKET_TAG} L={L} /></td>
                      <td className="note">{formatDateOnly(x.createdAt, lang)}</td>
                      <td className="tickets-panel-layout-22" >
                        <button className="tickets-panel-layout-23"
                          type="button"
                          title={tr(L, 't_manage', 'Gestionar')}
                          onClick={() => setDialog({ kind: 'ticket', ticket: x })}
                          
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
  );
}

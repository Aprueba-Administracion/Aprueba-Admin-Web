import { Card, Loading, ErrorBox, EmptyState, Field, Select, Pill, IconFlag, IconInfo } from "../../components/ui.jsx";
import { COR_TAG, REASON_OPTIONS, SvgSearch } from "./shared.jsx";

export default function CorrectionsPanel({ cSearch, setCSearch, cReason, setCReason, cDate, setCDate, setCFilters, correctionCounts, cFilters, isAdmin, L, cErr, loadCorrections, filteredCorrections, questionsById, lang, setDialog }) {
  return (
<Card className="tab-fade corrections-panel-layout-1" >
          <div className="flex corrections-panel-layout-2" >
            <h2 className="corrections-panel-layout-3" >Recorrecciones</h2>
            <div className="corrections-panel-layout-4" >
              <input
                type="text"
                className="grow corrections-panel-layout-5"
                
                placeholder="Buscar por pregunta, alumno o ID..."
                value={cSearch}
                onChange={(e) => setCSearch(e.target.value)}
              />
              <span className="corrections-panel-layout-6" >
                <SvgSearch />
              </span>
            </div>
          </div>

          {/* Filtros: Motivo, Fecha y Limpiar (sin el dropdown de Estado) */}
          <div className="corrections-panel-layout-7" >
            <Field label="Motivo">
              <Select
                value={cReason}
                onChange={setCReason}
                options={REASON_OPTIONS}
              />
            </Field>

            <Field label="Fecha">
              <input className="corrections-panel-layout-8"
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
                
              />
            </Field>

            <button
              className="btn sec sm corrections-panel-layout-9"
              
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
          <div className="flex corrections-panel-layout-10" >
            {[
              { id: '', label: 'Todos', count: correctionCounts.all, dotColor: '#3b82f6' },
              { id: 'pending', label: 'Pendientes', count: correctionCounts.pending, dotColor: '#f59e0b' },
              { id: 'confirmed', label: 'Confirmadas', count: correctionCounts.confirmed, dotColor: '#10b981' },
              { id: 'rejected', label: 'Rechazadas', count: correctionCounts.rejected, dotColor: '#ef4444' },
            ].map((tabItem) => {
              const active = (cFilters.status || '') === tabItem.id;
              return (
                <button className="corrections-panel-layout-11"
                  key={tabItem.id}
                  type="button"
                  onClick={() => setCFilters((f) => ({ ...f, status: tabItem.id }))}
                  style={{ "--corrections-panel-layout-11-border-bottom": ((value) => typeof value === 'number' ? value + 'px' : value)(active ? `2px solid ${tabItem.dotColor}` : '2px solid transparent'), "--corrections-panel-layout-11-font-weight": active ? 700 : 500, "--corrections-panel-layout-11-color": ((value) => typeof value === 'number' ? value + 'px' : value)(active ? 'var(--ink)' : 'var(--muted)') }}
                >
                  <span className="corrections-panel-layout-12" style={{ "--corrections-panel-layout-12-background": ((value) => typeof value === 'number' ? value + 'px' : value)(tabItem.dotColor) }} />
                  {tabItem.label}
                  <span className="corrections-panel-layout-13">
                    {tabItem.count}
                  </span>
                </button>
              );
            })}
          </div>

          {!isAdmin && (
            <p className="note corrections-panel-layout-14" >
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
                  <tr className="corrections-panel-layout-15" >
                    <th className="corrections-panel-layout-16" >#</th>
                    <th>Pregunta</th>
                    <th>Alumno</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Recibido</th>
                    <th className="corrections-panel-layout-17" >Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCorrections.map((c) => {
                    const q = questionsById?.[c.questionId];
                    const isPending = (c.status || 'pending') === 'pending';
                    const dateText = c.createdAt ? new Date(c.createdAt).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US') : '—';

                    return (
                      <tr className="corrections-panel-layout-18" key={c.id} >
                        <td className="note corrections-panel-layout-19" >
                          {c.questionId || c.id}
                        </td>
                        <td>
                          <div className="corrections-panel-layout-20" >
                            {q?.statement || c.questionStatement || c.questionId}
                          </div>
                        </td>
                        <td className="corrections-panel-layout-21" >{c.userName || c.userId}</td>
                        <td className="note">{L(`reason_${c.reason}`) || c.reason}</td>
                        <td>
                          <Pill value={c.status || 'pending'} map={COR_TAG} L={L} />
                        </td>
                        <td className="note">{dateText}</td>
                        <td className="corrections-panel-layout-22" >
                          <button
                            type="button"
                            className={(`btn sm ${isPending ? '' : 'sec'}` || '') + ' corrections-panel-layout-23'}
                            onClick={() => setDialog({ kind: 'correction', correction: c, question: q })}
                            
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
  );
}

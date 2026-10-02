import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client.js";

import { Loading, ErrorBox, Modal, Field, Select, KV } from "../../components/ui.jsx";
import { PRI_TAG, TICKET_TAG, TICKET_CATEGORIES, initials, tr, formatDateTime, SvgClock, SvgCalendar } from "./shared.jsx";

export default function TicketDialog({ ticket, ctx, busy, me, agentOptions, onClose, onSave }) {
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
      <div className="ticket-dialog-layout-1" >
        {/* Columna Izquierda */}
        <div className="ticket-dialog-layout-2" >
          <div className="ticket-dialog-layout-3" >
            <div className="ticket-dialog-layout-4" >
              {initials(t.userName || t.user)}
            </div>
            <div className="ticket-dialog-layout-5" >
              <div className="ticket-dialog-layout-6" >
                {t.userName || t.user}
              </div>
              <div className="note ticket-dialog-layout-7" >
                {t.userEmail || t.email || 'Sin correo asociado'}
              </div>
            </div>
            {t.channel && (
              <span className="tag ticket-dialog-layout-8" >
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

          <div className="ticket-dialog-layout-9" >
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
            <div className="flex ticket-dialog-layout-10" >
              <Select className="ticket-dialog-layout-11"
                value={assigneeId}
                onChange={setAssigneeId}
                placeholder="Sin asignar"
                options={agentOptions}
                
              />
              <button
                className="btn sec sm ticket-dialog-layout-12"
                type="button"
                onClick={() => setAssigneeId(me?.id || '')}
                
              >
                Asignarme
              </button>
            </div>
          </Field>

          <div className="ticket-dialog-layout-13" >
            <div className="flex ticket-dialog-layout-14" >
              <SvgClock />
              <div>
                <div className="note ticket-dialog-layout-15" >Fecha emitida</div>
                <div className="ticket-dialog-layout-16" >{formatDateTime(t.createdAt, lang)}</div>
              </div>
            </div>
            <div className="flex ticket-dialog-layout-17" >
              <SvgCalendar />
              <div>
                <div className="note ticket-dialog-layout-18" >Cerrado</div>
                <div className="ticket-dialog-layout-19" >
                  {t.closedAt ? formatDateTime(t.closedAt, lang) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="ticket-dialog-layout-20" >
          <div className="flex ticket-dialog-layout-21" >
            <button className="ticket-dialog-layout-22"
              type="button"
              onClick={() => setDialogTab('conversation')}
              style={{ "--ticket-dialog-layout-22-border-bottom": ((value) => typeof value === 'number' ? value + 'px' : value)(dialogTab === 'conversation' ? '2px solid #2563eb' : '2px solid transparent'), "--ticket-dialog-layout-22-font-weight": dialogTab === 'conversation' ? 700 : 500, "--ticket-dialog-layout-22-color": ((value) => typeof value === 'number' ? value + 'px' : value)(dialogTab === 'conversation' ? '#2563eb' : 'var(--muted)') }}
            >
              Conversación
            </button>
            <button className="ticket-dialog-layout-23"
              type="button"
              onClick={() => setDialogTab('info')}
              style={{ "--ticket-dialog-layout-23-border-bottom": ((value) => typeof value === 'number' ? value + 'px' : value)(dialogTab === 'info' ? '2px solid #2563eb' : '2px solid transparent'), "--ticket-dialog-layout-23-font-weight": dialogTab === 'info' ? 700 : 500, "--ticket-dialog-layout-23-color": ((value) => typeof value === 'number' ? value + 'px' : value)(dialogTab === 'info' ? '#2563eb' : 'var(--muted)') }}
            >
              Información adicional
            </button>
          </div>

          {dialogTab === 'conversation' ? (
            <div className="ticket-dialog-layout-24" >
              <div className="ticket-dialog-layout-25" >
                {loadErr && <ErrorBox msg={loadErr} L={L} />}
                {!detail && !loadErr ? (
                  <Loading L={L} />
                ) : (t.messages || []).length === 0 ? (
                  <p className="note ticket-dialog-layout-26" >Sin mensajes registrados</p>
                ) : (
                  (t.messages || []).map((m) => {
                    const isStaff = m.authorType === 'agent' || m.authorType === 'admin';

                    return (
                      <div className="ticket-dialog-layout-27"
                        key={m.id}
                        style={{ "--ticket-dialog-layout-27-flex-direction": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? 'row-reverse' : 'row'), "--ticket-dialog-layout-27-align-self": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? 'flex-end' : 'flex-start') }}
                      >
                        <div className="ticket-dialog-layout-28"
                          style={{ "--ticket-dialog-layout-28-background": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? 'var(--brand)' : 'var(--chat-user-border)'), "--ticket-dialog-layout-28-color": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? '#ffffff' : 'var(--chat-user-name)') }}
                        >
                          {initials(m.authorName || (isStaff ? 'AD' : t.userName))}
                        </div>

                        <div className="ticket-dialog-layout-29"
                          style={{ "--ticket-dialog-layout-29-background": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? 'var(--chat-staff-bg)' : 'var(--chat-user-bg)'), "--ticket-dialog-layout-29-border": ((value) => typeof value === 'number' ? value + 'px' : value)(`1px solid ${isStaff ? 'var(--chat-staff-border)' : 'var(--chat-user-border)'}`), "--ticket-dialog-layout-29-border-radius": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? '14px 4px 14px 14px' : '4px 14px 14px 14px') }}
                        >
                          <div className="ticket-dialog-layout-30" >
                            <span className="ticket-dialog-layout-31" style={{ "--ticket-dialog-layout-31-color": ((value) => typeof value === 'number' ? value + 'px' : value)(isStaff ? 'var(--chat-staff-name)' : 'var(--chat-user-name)') }}>
                              {m.authorName}
                            </span>
                            <span className="note ticket-dialog-layout-32" >
                              {formatDateTime(m.createdAt, lang)}
                            </span>
                          </div>
                          <div className="ticket-dialog-layout-33" >
                            {m.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="ticket-dialog-layout-34" >
                <Field
                  label="Respuesta al alumno"
                  hint={sendingMsg ? 'Enviando mensaje…' : 'Presiona Enter para enviar (Shift + Enter para salto de línea)'}
                >
                  <textarea className="ticket-dialog-layout-35"
                    rows={3}
                    placeholder="Escribe una respuesta y presiona Enter..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sendingMsg}
                    
                  />
                </Field>
              </div>

              <div className="flex ticket-dialog-layout-36" >
                <button type="button" className="btn sec" onClick={onClose} disabled={busy || sendingMsg}>
                  Cancelar
                </button>
                <button type="button" className="btn" onClick={submitMeta} disabled={busy || sendingMsg}>
                  {busy ? '…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div className="ticket-dialog-layout-37" >
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

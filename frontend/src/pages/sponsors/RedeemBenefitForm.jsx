import { useEffect, useState } from 'react';
import { api, qs } from '../../api/client.js';
import { Modal, Field, FormGrid, IconDiamond } from '../../components/ui.jsx';

// Canje administrativo de un beneficio a nombre de un alumno.
// Mismo contrato que POST /sponsors/:id/benefits/:benefitId/redeem:
// { userId, cantidad, requestId }. El requestId se genera una sola vez por canje
// y se reutiliza al reintentar, para que un reintento nunca cobre dos veces.
const newRequestId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

export function RedeemBenefitForm({ sponsor, benefit, isEn, onClose, onCompleted, fmt }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(false);
  const [selected, setSelected] = useState(null); // { id, name?, email?, medals? }
  const [manualId, setManualId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const cantidad = Number(quantity);
  const cost = Number(benefit.costPlatinum) || 0;
  const total = Number.isSafeInteger(cantidad) && cantidad > 0 ? cost * cantidad : null;
  const balance = selected?.medals ? (selected.medals.platinum ?? 0) : null;
  const notEnough = balance != null && total != null && balance < total;
  const locked = !!pending || sending;
  const number = (n) => (fmt ? fmt(n) : String(n));

  // Búsqueda de alumnos activos por nombre o correo (con pausa de 300 ms al escribir).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearchErr(false); return undefined; }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get(`/users${qs({ q, state: 'active', limit: 6 })}`);
        if (!cancelled) { setResults(r.data || []); setSearchErr(false); }
      } catch { if (!cancelled) { setResults([]); setSearchErr(true); } }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [query]);

  const userId = selected?.id || manualId.trim();

  const submit = async () => {
    if (sending || receipt) return;
    if (!userId || total == null) {
      setError(isEn ? 'Choose a student and enter a positive whole quantity.' : 'Elige un alumno e ingresa una cantidad entera positiva.');
      return;
    }
    // Mismo cuerpo e identificador tras errores de red.
    const body = pending || { userId, cantidad, requestId: newRequestId() };
    setPending(body);
    setSending(true);
    setError('');
    try {
      const response = await api.post(
        `/sponsors/${encodeURIComponent(sponsor.id)}/benefits/${encodeURIComponent(benefit.id)}/redeem`,
        body,
      );
      setReceipt(response.data.redemption);
    } catch (e) {
      setError(e.message || (isEn ? 'Redemption failed' : 'No se pudo realizar el canje'));
    } finally {
      setSending(false);
    }
  };

  const title = isEn ? 'Redeem benefit' : 'Canjear beneficio';
  const subtitle = `${benefit.name} — ${sponsor.name}`;

  if (receipt) {
    return (
      <Modal title={title} subtitle={subtitle} onClose={onCompleted}
        footer={<button className="btn" onClick={onCompleted}>{isEn ? 'Done' : 'Finalizar'}</button>}>
        <p className="rd-ok" role="status">{isEn ? 'Redemption completed.' : 'Canje completado.'}</p>
        <dl className="rd-sum">
          <dt>{isEn ? 'Student' : 'Alumno'}</dt><dd>{selected?.name || receipt.userId}</dd>
          <dt>{isEn ? 'Quantity' : 'Cantidad'}</dt><dd>{number(receipt.cantidad)}</dd>
          <dt>{isEn ? 'Platinum charged' : 'Platino descontado'}</dt><dd>{number(receipt.totalCostPlatinum)}</dd>
          <dt>{isEn ? 'Remaining platinum' : 'Saldo de platino'}</dt><dd>{number(receipt.balanceAfter)}</dd>
          <dt>{isEn ? 'Stock left' : 'Stock restante'}</dt><dd>{number(receipt.stockAfter)}</dd>
          <dt>{isEn ? 'Receipt' : 'Comprobante'}</dt><dd className="rd-mono">{receipt.id}</dd>
        </dl>
      </Modal>
    );
  }

  return (
    <Modal busy={sending} title={title} subtitle={subtitle} onClose={onClose}
      footer={(
        <>
          <button className="btn sec" onClick={onClose} disabled={sending}>{isEn ? 'Close' : 'Cerrar'}</button>
          <button className="btn" onClick={submit} disabled={sending || notEnough || !userId}>
            {sending ? (isEn ? 'Processing…' : 'Procesando…')
              : pending ? (isEn ? 'Retry same request' : 'Reintentar solicitud')
                : (isEn ? 'Confirm redemption' : 'Confirmar canje')}
          </button>
        </>
      )}>
      <FormGrid>
        <Field wide label={isEn ? 'Student' : 'Alumno'}
          hint={isEn ? 'Search by name or email (active students only).' : 'Busca por nombre o correo (solo alumnos activos).'}>
          {selected ? (
            <div className="rd-picked">
              <div>
                <b>{selected.name || selected.id}</b>
                {selected.email && <div className="note">{selected.email}</div>}
              </div>
              <div className="rd-bal"><IconDiamond size={13} /> {balance != null ? number(balance) : '—'}</div>
              {!locked && <button type="button" className="btn sec sm" onClick={() => { setSelected(null); setQuery(''); }}>{isEn ? 'Change' : 'Cambiar'}</button>}
            </div>
          ) : (
            <>
              <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={locked}
                placeholder={isEn ? 'Name or email…' : 'Nombre o correo…'} />
              {searching && <div className="note rd-hint">{isEn ? 'Searching…' : 'Buscando…'}</div>}
              {!searchErr && !searching && query.trim().length >= 2 && results.length === 0 && (
                <div className="note rd-hint">{isEn ? 'No active students match.' : 'Ningún alumno activo coincide.'}</div>
              )}
              {results.length > 0 && (
                <div className="rd-users">
                  {results.map((u) => (
                    <button type="button" key={u.id} className="rd-user" onClick={() => setSelected(u)}>
                      <span><b>{u.name}</b><span className="note"> · {u.email}</span></span>
                      <span className="rd-bal"><IconDiamond size={12} /> {number(u.medals?.platinum ?? 0)}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchErr && (
                <div className="rd-manual">
                  <div className="note">{isEn ? 'Search is not available for your role. Paste the student ID instead.' : 'La búsqueda no está disponible para tu rol. Pega el ID del alumno.'}</div>
                  <input value={manualId} onChange={(e) => setManualId(e.target.value)} disabled={locked}
                    placeholder={isEn ? 'Student ID (Firestore UID)' : 'ID del alumno (UID de Firestore)'} />
                </div>
              )}
            </>
          )}
        </Field>

        <Field label={isEn ? 'Quantity' : 'Cantidad'}
          hint={`${isEn ? 'Stock' : 'Stock'}: ${number(benefit.stock || 0)}`}>
          <input type="number" min="1" step="1" max={benefit.stock} value={quantity} disabled={locked}
            onChange={(e) => setQuantity(e.target.value)} />
        </Field>

        <Field label={isEn ? 'Total cost' : 'Costo total'}>
          <div className="rd-total"><IconDiamond size={14} /> <b>{total != null ? number(total) : '—'}</b> {isEn ? 'platinum' : 'platino'}</div>
        </Field>
      </FormGrid>

      {notEnough && (
        <p className="rd-err" role="alert">{isEn ? 'This student does not have enough platinum medals.' : 'El alumno no tiene suficientes medallas de platino.'}</p>
      )}
      {error && <p className="rd-err" role="alert">{error}</p>}
      {pending && error && (
        <p className="note">{isEn
          ? 'Retry this same request to confirm its result. Do not start another redemption if the response was lost.'
          : 'Reintenta esta misma solicitud para confirmar el resultado. No inicies otro canje si se perdió la respuesta.'}</p>
      )}
    </Modal>
  );
}

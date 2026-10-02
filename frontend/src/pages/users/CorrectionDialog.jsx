import { useMemo, useState } from "react";

import { Modal, Field, Select } from "../../components/ui.jsx";

export default function CorrectionDialog({ correction, question, ctx, busy, isAdmin, onClose, onResolve }) {
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
      <div className="correction-dialog-layout-1" >
        {/* Columna Izquierda: Contexto pregunta y propuesta */}
        <div className="correction-dialog-layout-2" >
          <div>
            <div className="section-label tight correction-dialog-layout-3" >
              PREGUNTA
            </div>
            <p className="correction-dialog-layout-4" >
              {question?.statement || correction.questionStatement || correction.questionId}
            </p>
          </div>

          {options.length > 0 && (
            <div>
              <div className="note correction-dialog-layout-5" >Alternativas (resaltada la correcta actual):</div>
              <div className="correction-dialog-layout-6" >
                {options.map((optText, i) => {
                  const letter = letters[i];
                  const isCurrentCorrect = question?.correctAnswer === letter;
                  return (
                    <div className="correction-dialog-layout-7"
                      key={letter}
                      style={{ "--correction-dialog-layout-7-font-weight": isCurrentCorrect ? 700 : 500, "--correction-dialog-layout-7-background": ((value) => typeof value === 'number' ? value + 'px' : value)(isCurrentCorrect ? '#1d4ed8' : '#f1f5f9'), "--correction-dialog-layout-7-color": ((value) => typeof value === 'number' ? value + 'px' : value)(isCurrentCorrect ? '#ffffff' : 'var(--ink)'), "--correction-dialog-layout-7-border": ((value) => typeof value === 'number' ? value + 'px' : value)(isCurrentCorrect ? '1px solid #1d4ed8' : '1px solid var(--line)') }}
                    >
                      <span className="correction-dialog-layout-8" >{letter}.</span>
                      <span>{optText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="section-label tight correction-dialog-layout-9" >
              Respuesta propuesta por el alumno
            </div>
            <div className="correction-dialog-layout-10" >
              <span>{correction.proposedAnswer || 'No especificada'}</span>
              {isProposedValid && (
                <span className="tag correction-dialog-layout-11" >Opción {proposedClean}</span>
              )}
            </div>
          </div>

          <div>
            <div className="section-label tight correction-dialog-layout-12" >
              Comentario del alumno
            </div>
            <div className="correction-dialog-layout-13" >
              {correction.comment || 'Sin comentarios adicionales.'}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Decisión y corrección con selector */}
        <div className="correction-dialog-layout-14" >
          <div className="section-label tight correction-dialog-layout-15" >
            DECISIÓN
          </div>

          <div className="correction-dialog-layout-16" >
            <div className="correction-dialog-layout-17"
              onClick={() => !isReadOnly && setResolution('confirmed')}
              style={{ "--correction-dialog-layout-17-cursor": ((value) => typeof value === 'number' ? value + 'px' : value)(isReadOnly ? 'default' : 'pointer'), "--correction-dialog-layout-17-border": ((value) => typeof value === 'number' ? value + 'px' : value)(resolution === 'confirmed' ? '2px solid #10b981' : '1px solid var(--line)'), "--correction-dialog-layout-17-background": ((value) => typeof value === 'number' ? value + 'px' : value)(resolution === 'confirmed' ? '#f0fdf4' : '#fff') }}
            >
              <div className="flex correction-dialog-layout-18" >
                <span className="correction-dialog-layout-19" >✓</span>
                <span className="correction-dialog-layout-20" >Confirmar</span>
              </div>
              <div className="correction-dialog-layout-21" >El alumno recibe 250 badges</div>
            </div>

            <div className="correction-dialog-layout-22"
              onClick={() => !isReadOnly && setResolution('rejected')}
              style={{ "--correction-dialog-layout-22-cursor": ((value) => typeof value === 'number' ? value + 'px' : value)(isReadOnly ? 'default' : 'pointer'), "--correction-dialog-layout-22-border": ((value) => typeof value === 'number' ? value + 'px' : value)(resolution === 'rejected' ? '2px solid #ef4444' : '1px solid var(--line)'), "--correction-dialog-layout-22-background": ((value) => typeof value === 'number' ? value + 'px' : value)(resolution === 'rejected' ? '#fef2f2' : '#fff') }}
            >
              <div className="flex correction-dialog-layout-23" >
                <span className="correction-dialog-layout-24" >✕</span>
                <span className="correction-dialog-layout-25" >Rechazar</span>
              </div>
              <div className="correction-dialog-layout-26" >No se otorgan badges</div>
            </div>
          </div>

          {resolution === 'confirmed' && question && (
            <div className="correction-dialog-layout-27" >
              <label className="check correction-dialog-layout-28" >
                <input
                  type="checkbox"
                  checked={fix}
                  onChange={(e) => setFix(e.target.checked)}
                  disabled={isReadOnly}
                />
                <span>Corregir la pregunta al confirmar</span>
              </label>
              <div className="note correction-dialog-layout-29" >
                Opcional. Se envía como questionPatch y solo se aplica si confirmas.
              </div>

              {fix && (
                <div className="correction-dialog-layout-30" >
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
                    <div className="correction-dialog-layout-31" >
                      {availableOptionItems.map((item) => {
                        const isChosen = correctAnswer === item.letter;
                        return (
                          <button className="correction-dialog-layout-32"
                            key={item.letter}
                            type="button"
                            onClick={() => setCorrectAnswer(item.letter)}
                            style={{ "--correction-dialog-layout-32-border": ((value) => typeof value === 'number' ? value + 'px' : value)(isChosen ? '2px solid #2563eb' : '1px solid var(--line)'), "--correction-dialog-layout-32-background": ((value) => typeof value === 'number' ? value + 'px' : value)(isChosen ? '#2563eb' : '#fff'), "--correction-dialog-layout-32-color": ((value) => typeof value === 'number' ? value + 'px' : value)(isChosen ? '#fff' : 'var(--ink)') }}
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

          <div className="correction-dialog-layout-33" >
            <Field label="Nota del revisor (opcional)">
              <textarea className="correction-dialog-layout-34"
                rows={3}
                placeholder="Escribe una nota interna o respuesta..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isReadOnly}
                
              />
            </Field>
            <div className="note correction-dialog-layout-35" >
              El alumno la verá en la notificación de resolución.
            </div>
          </div>

          <div className="flex correction-dialog-layout-36" >
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

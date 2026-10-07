import { isEmpty } from '@shared/fields.js';
import { FieldInput } from './Inputs.jsx';

export const fieldId = (key) => `f-${key}`;

export function Messages({ error, warning }) {
  return (
    <>
      {error && <div className="msg msg-error" role="alert">{error}</div>}
      {!error && warning && <div className="msg msg-warn">{warning}</div>}
    </>
  );
}

/** A labelled field with the Excel column tag, hints, suggestion button and messages. */
export default function Field({ def, data, onChange, error, warning }) {
  const id = fieldId(def.key);
  const value = data[def.key];
  const scopeVal = def.scopeKey ? data[def.scopeKey] : undefined;
  const suggestion = def.suggest ? def.suggest(data) : undefined;

  return (
    <div className={`field ${def.full || def.type === 'longtext' ? 'full' : ''} ${error ? 'has-error' : warning ? 'has-warn' : ''}`}>
      <label htmlFor={id} className="field-label">
        <span>{def.label}{def.required && <b className="req" aria-hidden="true"> *</b>}</span>
        <span className="col-tag" title="Excel column">{def.col}</span>
      </label>
      <FieldInput def={def} value={value} onChange={(v) => onChange(def.key, v)} id={id} invalid={!!error} data={data} />
      {def.scopeKey && <div className="hint">Scope: {isEmpty(scopeVal) ? '—' : String(scopeVal)}</div>}
      {def.note && !def.side && <div className="hint">{def.note}</div>}
      {def.suggest && (
        <button type="button" className="link-btn" onClick={() => onChange(def.key, suggestion)}>
          Use suggested value ({suggestion}, {def.suggestNote})
        </button>
      )}
      <Messages error={error} warning={warning} />
    </div>
  );
}

import { BUTTON_MAX, NA, isEmpty } from '@shared/fields.js';

// One reusable input per field type. Each takes { def, value, onChange, id, label, invalid }.

const orEmpty = (v) => (isEmpty(v) ? '' : v);

export function LockIcon() {
  return (
    <svg className="lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm-2 3.5a2 2 0 1 1 4 0V6H6V4.5Z" />
    </svg>
  );
}

export function AutoBox({ def, value, id }) {
  const empty = isEmpty(value);
  return (
    <div className="auto-box" id={id} aria-readonly="true">
      <LockIcon />
      <span>{empty ? (def.key === 'sn' ? 'Assigned on save' : '—') : String(value)}</span>
    </div>
  );
}

export function TextInput({ def, value, onChange, id, label, invalid, placeholder }) {
  return (
    <input id={id} type="text" aria-label={label} aria-invalid={invalid || undefined} value={orEmpty(value)}
      placeholder={placeholder} className={def.upper ? 'upper' : ''} autoComplete="off"
      onChange={(e) => {
        const v = def.upper ? e.target.value.toUpperCase() : e.target.value;
        onChange(v === '' ? null : v);
      }} />
  );
}

export function LongText({ value, onChange, id, label, invalid }) {
  return (
    <textarea id={id} rows={3} aria-label={label} aria-invalid={invalid || undefined} value={orEmpty(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
  );
}

export function Choice({ def, value, onChange, id, label, invalid, data }) {
  const opts = (def.getDynamicOptions && data) ? def.getDynamicOptions(data) : def.options;
  const hasOld = !isEmpty(value) && !opts.includes(value);

  if (def.allowTyping) {
    return (
      <>
        <input id={id} list={`${id}-list`} type="text" aria-label={label} aria-invalid={invalid || undefined}
          value={orEmpty(value)} autoComplete="off" placeholder="Select or type"
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
        <datalist id={`${id}-list`}>{opts.map((o) => <option key={o} value={o} />)}</datalist>
      </>
    );
  }

  if (opts.length <= BUTTON_MAX) {
    const shown = hasOld ? [...opts, value] : opts;
    return (
      <div id={id} className="seg" role="group" aria-label={label} aria-invalid={invalid || undefined}>
        {shown.map((o) => (
          <button key={o} type="button" aria-pressed={value === o}
            className={`seg-btn ${value === o ? 'on' : ''} ${o === value && hasOld ? 'old' : ''}`}
            onClick={() => onChange(value === o ? null : o)}>{o}</button>
        ))}
      </div>
    );
  }

  return (
    <select id={id} aria-label={label} aria-invalid={invalid || undefined} value={orEmpty(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
      <option value="">—</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      {hasOld && <option value={value}>{String(value)}</option>}
    </select>
  );
}

function NaToggle({ on, onClick, label }) {
  return (
    <button type="button" className={`na-btn ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${label}: not applicable`}
      onClick={onClick}>NA</button>
  );
}

function NumberNA({ value, onChange, id, label, invalid, step, suffix }) {
  const isNA = value === NA;
  return (
    <div className="na-wrap">
      <div className={`num-box ${suffix ? 'has-suffix' : ''}`}>
        <input id={id} type="number" min="0" step={step} inputMode={step === '1' ? 'numeric' : 'decimal'}
          aria-label={label} aria-invalid={invalid || undefined} disabled={isNA}
          value={isNA ? '' : orEmpty(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      <NaToggle on={isNA} label={label} onClick={() => onChange(isNA ? null : NA)} />
    </div>
  );
}

export const CountNA = (p) => <NumberNA {...p} step="1" />;
export const MetresNA = (p) => <NumberNA {...p} step="any" suffix="m" />;

export function DateNA({ value, onChange, id, label, invalid }) {
  const isNA = value === NA;
  const ok = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return (
    <div className="na-wrap">
      <input id={id} type="date" aria-label={label} aria-invalid={invalid || undefined} disabled={isNA}
        value={ok ? value : ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
      <NaToggle on={isNA} label={label} onClick={() => onChange(isNA ? null : NA)} />
    </div>
  );
}

export function YearInput({ value, onChange, id, label, invalid }) {
  return (
    <input id={id} type="number" min="2000" max="2100" step="1" inputMode="numeric" aria-label={label}
      aria-invalid={invalid || undefined} value={orEmpty(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
  );
}

/** Picks the right input for a field definition. */
export function FieldInput({ def, value, onChange, id, invalid, data }) {
  const p = { def, value, onChange, id, invalid, label: def.label, data };
  switch (def.type) {
    case 'text': return <TextInput {...p} placeholder={def.side ? def.note : undefined} />;
    case 'longtext': return <LongText {...p} />;
    case 'select': return <Choice {...p} />;
    case 'count': return <CountNA {...p} />;
    case 'metres': return <MetresNA {...p} />;
    case 'date': return <DateNA {...p} />;
    case 'year': return <YearInput {...p} />;
    case 'auto': return <AutoBox def={def} value={value} id={id} />;
    default: return null;
  }
}

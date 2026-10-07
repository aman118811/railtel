import { isEmpty } from '@shared/fields.js';
import { FieldInput } from './Inputs.jsx';
import { Messages, fieldId } from './Field.jsx';

function Cell({ def, side, data, onChange, errors, warnings }) {
  if (!def) {
    return <div className={`cmp-cell ${side}`} data-label={side === 'scope' ? 'Scope' : 'Actual'}><span className="muted dash" aria-label="Not in this block">—</span></div>;
  }
  const err = errors[def.key];
  const warn = warnings[def.key];
  return (
    <div className={`cmp-cell ${side} ${err ? 'has-error' : warn ? 'has-warn' : ''}`} data-label={side === 'scope' ? 'Scope' : 'Actual'}>
      <div className="cmp-input">
        <FieldInput def={def} value={data[def.key]} onChange={(v) => onChange(def.key, v)} id={fieldId(def.key)} invalid={!!err} />
        <span className="col-tag" title="Excel column">{def.col}</span>
      </div>
      <Messages error={err} warning={warn} />
    </div>
  );
}

function Match({ scope, actual, data }) {
  if (!scope || !actual) return <div className="cmp-match" />;
  const a = data[scope.key];
  const b = data[actual.key];
  if (isEmpty(a) || isEmpty(b)) return <div className="cmp-match" />;
  const same = String(a) === String(b);
  return same
    ? <div className="cmp-match ok" title="Scope and actual match" aria-label="Match">✓</div>
    : <div className="cmp-match diff" title="Scope and actual differ" aria-label="Different">≠</div>;
}

export default function CompareSection({ section, data, onChange, errors, warnings }) {
  const copyBlockScopeToActual = (block) => {
    for (const it of block.items) {
      if (it.scope && it.actual && !isEmpty(data[it.scope.key])) {
        onChange(it.actual.key, data[it.scope.key]);
      }
    }
  };

  const copyAllScopeToActual = () => {
    for (const block of section.blocks) {
      copyBlockScopeToActual(block);
    }
  };

  return (
    <>
      <div className="cmp-toolbar">
        <button type="button" className="btn btn-sm" onClick={copyAllScopeToActual} title="Copy all surveyed scope numbers into actual installed fields">
          ⚡ Copy All Scope to Actual
        </button>
      </div>
      {section.blocks.map((block) => (
        <div className="cmp-block" key={block.title}>
          <div className="cmp-block-head">
            <h4 className="subhead">{block.title}</h4>
            <button type="button" className="btn-link-sm" onClick={() => copyBlockScopeToActual(block)} title={`Copy ${block.title} scope to actual`}>
              ⚡ Copy block
            </button>
          </div>
          <div className="cmp" role="table" aria-label={block.title}>
            <div className="cmp-head" role="row">
              <span role="columnheader">Item</span>
              <span role="columnheader" className="h-scope">Scope</span>
              <span role="columnheader" className="h-actual">Actual</span>
              <span role="columnheader" className="h-match">Match</span>
            </div>
            {block.items.map((it) => (
              <div className="cmp-row" role="row" key={it.key}>
                <div className="cmp-item" role="rowheader">
                  <span>{it.label}</span>
                  {it.note && <small>{it.note}</small>}
                </div>
                <Cell def={it.scope} side="scope" data={data} onChange={onChange} errors={errors} warnings={warnings} />
                <Cell def={it.actual} side="actual" data={data} onChange={onChange} errors={errors} warnings={warnings} />
                <Match scope={it.scope} actual={it.actual} data={data} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

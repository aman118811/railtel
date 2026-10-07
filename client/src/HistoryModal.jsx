import { useEffect, useMemo, useState } from 'react';
import { FIELD_BY_KEY, SECTIONS } from '@shared/fields.js';
import { api } from './api.js';
import { fmtDateTime } from './format.js';

const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

const SECTION_TITLE_MAP = Object.fromEntries(SECTIONS.map((s) => [s.id, `Sec ${s.number}: ${s.title}`]));

export default function HistoryModal({ stationId, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.history(stationId).then(setRows).catch((e) => setError(e.message));
  }, [stationId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    if (!filter.trim()) return rows;
    const q = filter.trim().toLowerCase();
    return rows.map((h) => {
      const matchMeta = (h.changed_by || '').toLowerCase().includes(q) || h.action.toLowerCase().includes(q);
      const matchedEntries = Object.entries(h.changes).filter(([k, c]) => {
        const field = FIELD_BY_KEY[k];
        const label = (field?.label || k).toLowerCase();
        const col = (field?.col || '').toLowerCase();
        const fromVal = show(c.from).toLowerCase();
        const toVal = show(c.to).toLowerCase();
        return label.includes(q) || col.includes(q) || fromVal.includes(q) || toVal.includes(q);
      });
      if (matchMeta) return h;
      if (matchedEntries.length) return { ...h, changes: Object.fromEntries(matchedEntries) };
      return null;
    }).filter(Boolean);
  }, [rows, filter]);

  const handleCopy = () => {
    if (!rows || !rows.length) return;
    const text = rows.map((h) => {
      const header = `[${h.action.toUpperCase()}] by ${h.changed_by || 'Unknown'} at ${fmtDateTime(h.changed_at)}`;
      const items = Object.entries(h.changes).map(([k, c]) => {
        const f = FIELD_BY_KEY[k];
        const label = f ? `${f.label} (${f.col})` : k;
        return `  • ${label}: "${show(c.from)}" → "${show(c.to)}"`;
      }).join('\n');
      return `${header}\n${items}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal hist-modal-wide" role="dialog" aria-modal="true" aria-label="Audit Log and Change History" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title-group">
            <h2>Station Audit Trail & History</h2>
            <span className="hist-badge-count">{rows ? `${rows.length} revision${rows.length === 1 ? '' : 's'}` : 'Loading…'}</span>
          </div>
          <div className="modal-head-actions">
            {rows && rows.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                {copied ? '✓ Copied Log' : '📋 Copy Log'}
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>

        {rows && rows.length > 1 && (
          <div className="hist-filter-bar">
            <input
              type="search"
              placeholder="Search changes by field, operator, or value…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="hist-search-input"
            />
          </div>
        )}

        <div className="modal-body hist-body">
          {error && <div className="banner banner-error">{error}</div>}
          {!rows && !error && <p className="muted">Loading audit history…</p>}
          {rows && rows.length === 0 && <p className="muted">No history recorded yet for this station.</p>}
          {filteredRows && filteredRows.length === 0 && rows.length > 0 && (
            <p className="muted">No changes matching “{filter}”.</p>
          )}
          {filteredRows?.map((h) => {
            const entries = Object.entries(h.changes);
            const isCreate = h.action === 'create';
            return (
              <article key={h.id} className={`hist-card ${isCreate ? 'hist-create' : 'hist-update'}`}>
                <div className="hist-head">
                  <div className="hist-meta-left">
                    <span className={`hist-action-pill ${isCreate ? 'pill-create' : 'pill-update'}`}>
                      {isCreate ? 'Created' : 'Updated'}
                    </span>
                    <span className="hist-author">
                      by <strong>{h.changed_by || 'Unknown Operator'}</strong>
                    </span>
                  </div>
                  <span className="hist-timestamp muted">{fmtDateTime(h.changed_at)}</span>
                </div>
                {isCreate ? (
                  <div className="hist-create-summary">
                    <span className="hist-summary-tag">Initial Creation</span>
                    <span className="muted">{entries.length} fields initialized</span>
                  </div>
                ) : (
                  <ul className="hist-diff-list">
                    {entries.map(([k, c]) => {
                      const f = FIELD_BY_KEY[k];
                      const sectionName = f?.section ? SECTION_TITLE_MAP[f.section] : null;
                      return (
                        <li key={k} className="hist-diff-item">
                          <div className="hist-diff-field">
                            <span className="hist-field-name">{f?.label || k}</span>
                            {f?.col && <span className="col-tag">{f.col}</span>}
                            {sectionName && <span className="hist-sec-tag">{sectionName}</span>}
                          </div>
                          <div className="hist-diff-values">
                            <span className="diff-val diff-from" title="Previous value">
                              <del>{show(c.from)}</del>
                            </span>
                            <span className="diff-arrow">→</span>
                            <span className="diff-val diff-to" title="New value">
                              <ins>{show(c.to)}</ins>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

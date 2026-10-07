import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OPTIONS, SHEET_TITLE, overallProgress } from '@shared/fields.js';
import { BUCKET_LABELS, SCHEME_SHORT, matchesReport } from '@shared/report.js';
import { api } from './api.js';
import OverviewTable from './OverviewTable.jsx';
import { rememberList } from './format.js';

const PAGE_SIZE = 50;

/**
 * The Stations page. All filters live in the page address (?status=&scheme=&zone=&bucket=&q=),
 * so the Report can link straight to "these stations", and Back from a form returns to the same list.
 */
export default function StationList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const scheme = params.get('scheme') || '';
  const zone = params.get('zone') || '';
  const division = params.get('division') || '';
  const grouped = params.get('group') !== 'flat';
  const bucket = params.get('bucket') || '';
  const q = params.get('q') || '';

  const [search, setSearch] = useState(q);
  const [page, setPage] = useState(0);
  const [all, setAll] = useState(null);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (key) => setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const update = (patch) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    return next;
  }, { replace: true });

  // Remember the list's filters so a form's Back button returns here.
  useEffect(() => {
    rememberList(`/stations/grouped?${params.toString()}`);
  }, [params]);

  // Typing in search updates the address after a short pause.
  useEffect(() => {
    const t = setTimeout(() => { if (search.trim() !== q) update({ q: search.trim() }); }, 250);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => { setSearch(q); }, [q]);

  useEffect(() => {
    let live = true;
    setError('');
    api.all().then((r) => { if (live) setAll(r); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);

  // Everything except the status filter, so the summary tiles can show counts for the other filters.
  const base = useMemo(() => {
    if (!all) return null;
    const needle = q.toLowerCase();
    return all
      .filter((s) => !division || s.division === division)
      .filter((s) => matchesReport(s, { scheme, zone, bucket }))
      .filter((s) => !needle || [s.stn_code, s.station_name, s.data.server_thana].some((v) => (v || '').toLowerCase().includes(needle)))
      .sort((a, b) => a.sn - b.sn);
  }, [all, scheme, zone, division, bucket, q]);

  // Grouped: Zone, then Division (stations with no division last), then S.N. Flat: S.N. only.
  const byGroup = (a, b) => a.zone.localeCompare(b.zone) || (a.division ? (b.division ? a.division.localeCompare(b.division) : -1) : (b.division ? 1 : 0)) || a.sn - b.sn;
  const rows = useMemo(() => (base ? base.filter((s) => !status || s.status === status).map((s) => ({ ...s, pct: overallProgress(s.data).pct })).sort(grouped ? byGroup : (a, b) => a.sn - b.sn) : null), [base, status, grouped]);
  const tileCounts = useMemo(() => {
    const c = { '': base?.length || 0 };
    for (const s of OPTIONS.STATUS) c[s] = (base || []).filter((r) => r.status === s).length;
    return c;
  }, [base]);

  useEffect(() => { setPage(0); }, [status, scheme, zone, division, bucket, q]);
  const pages = Math.max(1, Math.ceil((rows?.length || 0) / PAGE_SIZE));
  const visible = rows ? rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : [];

  // Active filters coming from the report (or set by hand), shown as removable chips.
  const chips = [
    scheme && { k: 'scheme', text: `Scheme: ${SCHEME_SHORT[scheme] || scheme}` },
    zone && { k: 'zone', text: `Zone: ${zone}` },
    division && { k: 'division', text: `Division: ${division}` },
    bucket && { k: 'bucket', text: `Showing: ${BUCKET_LABELS[bucket] || bucket}` },
    q && { k: 'q', text: `Search: “${q}”` },
  ].filter(Boolean);
  const clearAll = () => { setSearch(''); update({ scheme: '', zone: '', division: '', bucket: '', q: '', status: '' }); };

  return (
    <div className="page wide">
      <div className="list-head">
        <div>
          <h1>Stations</h1>
          <p className="sheet-title">{SHEET_TITLE}</p>
        </div>
        <div className="list-actions">
          <Link to="/stations/new" className="btn btn-primary">+ Add station</Link>
        </div>
      </div>

      <div className="tiles" role="group" aria-label="Filter by status">
        <button type="button" aria-pressed={status === ''} className={`tile ${status === '' ? 'on' : ''}`} onClick={() => update({ status: '' })}>
          <span className="tile-n">{tileCounts['']}</span><span className="tile-l">All stations</span>
        </button>
        {OPTIONS.STATUS.map((s) => (
          <button type="button" key={s} aria-pressed={status === s} className={`tile tone-${s.replace(/\s+/g, '-').toLowerCase()} ${status === s ? 'on' : ''}`}
            onClick={() => update({ status: status === s ? '' : s })}>
            <span className="tile-n">{tileCounts[s]}</span><span className="tile-l">{s}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="visually-hidden" htmlFor="q">Search stations</label>
        <input id="q" type="search" placeholder="Search code, name or thana" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="visually-hidden" htmlFor="status-filter">Status</label>
        <select id="status-filter" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {OPTIONS.STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={grouped} onChange={(e) => update({ group: e.target.checked ? '' : 'flat' })} />
          Group by Zone › Division
        </label>
      </div>

      {chips.length > 0 && (
        <div className="chips" aria-label="Active filters">
          {chips.map((c) => (
            <button type="button" key={c.k} className="chip" onClick={() => { if (c.k === 'q') setSearch(''); update({ [c.k]: '' }); }} aria-label={`Remove filter ${c.text}`}>
              {c.text} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-btn" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {error && <div className="banner banner-error" role="alert">Could not load stations: {error}</div>}

      <OverviewTable rows={visible} allRows={rows || []} loading={rows === null && !error} grouped={grouped} collapsed={collapsed} onToggle={toggleGroup} />

      <div className="pager">
        {rows && rows.length > PAGE_SIZE && <button type="button" className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>}
        <span>{rows ? `${rows.length} station${rows.length === 1 ? '' : 's'}` : ''}{rows && rows.length > PAGE_SIZE ? ` · page ${page + 1} of ${pages}` : ''}</span>
        {rows && rows.length > PAGE_SIZE && <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>}
      </div>
    </div>
  );
}

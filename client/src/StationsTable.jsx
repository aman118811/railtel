import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REGIONS } from '@shared/fields.js';
import { api } from './api.js';
import { UserContext, REGION_NAMES } from './App.jsx';
import StatusPill, { LifecyclePill } from './StatusPill.jsx';
import { compareQty, fmtDate, FLAG_LABEL, isCommissioned, rememberList } from './format.js';

const dash = (v) => (v === null || v === undefined || v === '' ? <span className="muted">—</span> : v);
const Num = ({ v }) => <span className="numeric">{v ?? 0}</span>;

const COLS = {
  code: { h: 'Station Code', sort: 'stn_code', cell: (s) => <Link className="code-link" to={`/stations/${s.id}/view`}>{s.stn_code}</Link> },
  name: { h: 'Station Name', sort: 'station_name', cell: (s) => <Link to={`/stations/${s.id}/view`} className="name-link">{s.station_name}</Link> },
  division: { h: 'Division', sort: 'division', cell: (s) => dash(s.division) },
  zone: { h: 'Zone', sort: 'zone', cell: (s) => s.zone },
  state: { h: 'State', sort: 'state', cell: (s) => dash(s.state) },
  oldcat: { h: 'Old Cat.', sort: 'old_category', cell: (s) => dash(s.old_category) },
  newcat: { h: 'New Cat.', sort: 'new_category', cell: (s) => dash(s.new_category) },
  phase1: { h: 'Phase-I', cell: (s) => dash(s.phase1) },
  scope: { h: 'Scope Cams', sort: 'scope_total', num: true, cell: (s) => <Num v={s.scope_total} /> },
  done: { h: 'Work Done Cams', sort: 'done_total', num: true, cell: (s) => <Num v={s.done_total} /> },
  commissioned: { h: 'Commissioned', cell: (s) => (isCommissioned(s.status) ? <b className="yes">Yes</b> : <span className="muted">No</span>) },
  handover: { h: 'Handover', cell: (s) => dash(s.handed_over) },
  handover_date: { h: 'Handover date', cell: (s) => fmtDate(s.handover_date) },
  handover_target: { h: 'Handover target', cell: (s) => fmtDate(s.handover_target) },
  hindrance: { h: 'Hindrance', cell: (s) => <span className="clip" title={s.hindrance_type || ''}>{dash(s.hindrance_type)}</span> },
  target: { h: 'Target Date', sort: 'target', cell: (s) => fmtDate(s.target_commission_date) },
  status: { h: 'Status', sort: 'status', cell: (s) => <StatusPill status={s.status} /> },
  stage: { h: 'Stage', sort: 'lifecycle', cell: (s) => <LifecyclePill value={s.lifecycle} draft={s.draft} /> },
  variance: {
    h: 'Variance', num: true,
    cell: (s) => { const c = compareQty(s.scope_total, s.done_total, isCommissioned(s.status)); return <span className={`numeric var-${c.flag}`}>{c.variance === null ? '—' : (c.variance > 0 ? `+${c.variance}` : c.variance)}</span>; },
  },
  progress: {
    h: 'Cameras done',
    cell: (s) => { const c = compareQty(s.scope_total, s.done_total, isCommissioned(s.status)); return c.pct === null ? <span className="muted">—</span> : <span className="bar-cell"><span className="bar"><span className={`bar-fill tone-${c.flag === 'over' ? 'amber' : c.flag === 'shortfall' ? 'red' : 'green'}`} style={{ width: `${c.pct}%` }} /></span><b>{c.pct}%</b></span>; },
  },
  flag: {
    h: 'Flag',
    cell: (s) => { const c = compareQty(s.scope_total, s.done_total, isCommissioned(s.status)); return c.flag === 'none' ? <span className="muted">—</span> : <span className={`flag flag-${c.flag}`}>{FLAG_LABEL[c.flag]}</span>; },
  },
  out_status: { h: 'Outdoor survey', cell: (s) => dash(s.out_status) },
  room: { h: 'Room', cell: (s) => dash(s.room) },
  power: { h: 'Power', cell: (s) => dash(s.power) },
  ac: { h: 'AC', cell: (s) => dash(s.ac) },
  dg: { h: 'DG', cell: (s) => dash(s.dg) },
  actions: {
    h: '', cell: (s, ctx) => (
      <span className="row-actions">
        <Link to={`/stations/${s.id}/view`}>View</Link>
        <Link to={s.draft ? `/stations/${s.id}/draft` : `/stations/${s.id}`}>{s.draft ? 'Continue' : 'Edit'}</Link>
        <button type="button" className="link-btn danger" onClick={() => ctx.onDelete(s)}>Delete</button>
      </span>
    ),
  },
};

export const PRESETS = {
  stations: {
    title: 'Stations', path: '/stations',
    cols: ['code', 'name', 'division', 'state', 'oldcat', 'newcat', 'phase1', 'scope', 'done', 'commissioned', 'handover', 'hindrance', 'target', 'status', 'stage', 'actions'],
  },
  progress: {
    title: 'Work Progress', path: '/progress', sub: 'Approved scope against work done, station by station. Source values are never changed.',
    cols: ['code', 'name', 'division', 'scope', 'done', 'variance', 'progress', 'flag', 'stage', 'actions'],
  },
  handover: {
    title: 'Handover & Commissioning', path: '/handover', sub: 'Targets, handover and hindrances.', defaultView: 'handover_pending',
    cols: ['code', 'name', 'division', 'status', 'target', 'handover', 'handover_date', 'handover_target', 'hindrance', 'stage', 'actions'],
  },
  infrastructure: {
    title: 'Infrastructure / Survey', path: '/infrastructure', sub: 'Outdoor survey status and the room, power, AC and DG position from the approved survey.',
    cols: ['code', 'name', 'division', 'out_status', 'room', 'power', 'ac', 'dg', 'stage', 'actions'],
  },
};

const VIEW_CHIPS = [
  ['', 'All'], ['commissioned', 'Commissioned'], ['in_progress', 'In progress'], ['hindrance', 'Hindrance'],
  ['handover_pending', 'Handover pending'], ['drafts', 'Drafts'], ['closed', 'Closed'],
];
const SIZES = [25, 50, 100];
const SAVED_KEY = 'cctv.savedViews';

function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } }
function storeSaved(v) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } }

export default function StationsTable({ preset = 'stations' }) {
  const P = PRESETS[preset];
  const { region, pickRegion } = useContext(UserContext);
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const hasView = params.has('view');
  const view = hasView ? get('view') : (P.defaultView || '');
  const q = get('q');
  const sort = get('sort') || 'sn';
  const dir = get('dir') || 'asc';
  const page = Number(get('page')) || 1;
  const pageSize = Number(get('size')) || 25;
  const filters = { project: get('project'), division: get('division'), state: get('state'), zone: get('zone'), status: get('status'), lifecycle: get('lifecycle') };
  const [projects, setProjects] = useState([]);
  useEffect(() => { api.projects({ stats: '0' }).then(setProjects).catch(() => {}); }, []);
  const projectName = (id) => (id === 'none' ? 'Not in any project' : projects.find((p) => p.id === id)?.name || id);

  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState(q);
  const [res, setRes] = useState(null);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(loadSaved);

  const update = (patch, resetPage = true) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (resetPage && !('page' in patch)) next.delete('page');
    return next;
  }, { replace: true });

  useEffect(() => { rememberList(`${P.path}?${params.toString()}`); }, [params, P.path]);
  useEffect(() => { api.facets().then(setFacets).catch(() => {}); }, []);
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (search.trim() !== q) update({ q: search.trim() }); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = useMemo(() => ({ ...filters, q, view, sort, dir, page, pageSize }), [filters.project, filters.division, filters.state, filters.zone, filters.status, filters.lifecycle, q, view, sort, dir, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    setError('');
    api.page(query).then((r) => { if (live) setRes(r); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [query, reload]);

  const { user } = useContext(UserContext);
  const onDelete = async (s) => {
    if (!window.confirm(`Delete station ${s.stn_code} ${s.station_name}?\n\nIt is removed from the list and from its projects. A copy is kept in the database archive.`)) return;
    try { await api.deleteStation(s.id, user); setReload((x) => x + 1); } catch (e) { setError(e.message); }
  };
  const cols = P.cols.map((k) => ({ key: k, ...COLS[k] }));
  const setSort = (s) => update({ sort: s, dir: sort === s && dir === 'asc' ? 'desc' : 'asc' });
  const activeFilters = Object.entries(filters).filter(([, v]) => v);
  const exportParams = { ...filters, q, view };

  const saveView = () => {
    const name = window.prompt('Name for this view');
    if (!name?.trim()) return;
    const next = [...saved.filter((s) => s.name !== name.trim()), { name: name.trim(), path: `${P.path}?${params.toString()}` }];
    setSaved(next); storeSaved(next);
  };
  const dropView = (name) => { const next = saved.filter((s) => s.name !== name); setSaved(next); storeSaved(next); };

  const pages = res?.pages || 1;
  return (
    <div className="page wide">
      <div className="list-head">
        <div>
          <h1>{P.title}</h1>
          <p className="sheet-title">{P.sub || `${region} Region${res ? ` · ${res.total.toLocaleString('en-IN')} station${res.total === 1 ? '' : 's'}` : ''}`}</p>
        </div>
        <div className="list-actions">
          <Link to="/stations/grouped" className="btn">Grouped view</Link>
          <a className="btn" href={api.exportUrl(exportParams)} download>Export CSV</a>
          <Link to={filters.project && filters.project !== 'none' ? `/stations/new?project=${filters.project}` : '/stations/new'} className="btn btn-primary">+ Create New Station</Link>
        </div>
      </div>

      {preset === 'stations' && (
        <div className="region-tabs" role="tablist" aria-label="Region">
          {REGIONS.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={r === region} className={`region-tab ${r === region ? 'on' : ''}`} title={` Region`} onClick={() => pickRegion(r)}>{r}</button>
          ))}
        </div>
      )}
      <div className="view-chips" role="group" aria-label="View">
        {VIEW_CHIPS.map(([v, l]) => (
          <button key={l} type="button" className={`vchip ${(view === 'all' ? '' : view) === v ? 'on' : ''}`} aria-pressed={(view === 'all' ? '' : view) === v}
            onClick={() => update({ view: v || (P.defaultView ? 'all' : '') })}>{l}</button>
        ))}
      </div>

      <div className="filters">
        <input type="search" placeholder="Search code, name or thana" aria-label="Search stations" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Project" value={filters.project} onChange={(e) => update({ project: e.target.value })}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="none">Not in any project</option>
        </select>
        <select aria-label="Division" value={filters.division} onChange={(e) => update({ division: e.target.value })}>
          <option value="">All divisions</option>{(facets?.divisions || []).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="State" value={filters.state} onChange={(e) => update({ state: e.target.value })}>
          <option value="">All states</option>{(facets?.states || []).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Zone" value={filters.zone} onChange={(e) => update({ zone: e.target.value })}>
          <option value="">All zones</option>{(facets?.zones || []).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>{(facets?.statuses || []).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Stage" value={filters.lifecycle} onChange={(e) => update({ lifecycle: e.target.value })}>
          <option value="">All stages</option>{(facets?.lifecycles || []).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Saved views" value="" onChange={(e) => { if (e.target.value) window.location.assign(e.target.value); }}>
          <option value="">Saved views…</option>{saved.map((s) => <option key={s.name} value={s.path}>{s.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={saveView}>Save this view</button>
      </div>

      {(activeFilters.length > 0 || q) && (
        <div className="chips" aria-label="Active filters">
          {activeFilters.map(([k, v]) => (
            <button type="button" key={k} className="chip" onClick={() => update({ [k]: '' })}>{k}: {k === 'project' ? projectName(v) : v} <span aria-hidden="true">×</span></button>
          ))}
          <button type="button" className="link-btn" onClick={() => { setSearch(''); update({ q: '', project: '', division: '', state: '', zone: '', status: '', lifecycle: '' }); }}>Clear all</button>
          {saved.length > 0 && <span className="muted small">Saved: {saved.map((s) => <button key={s.name} type="button" className="link-btn" title="Delete saved view" onClick={() => dropView(s.name)}>{s.name} ×</button>)}</span>}
        </div>
      )}

      {error && <div className="banner banner-error" role="alert">Could not load stations: {error}</div>}

      <div className="table-wrap">
        <table className="data-table list-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.num ? 'numeric' : ''} aria-sort={c.sort && sort === c.sort ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? <button type="button" className="th-btn" onClick={() => setSort(c.sort)}>{c.h}{sort === c.sort && <span className="sort-ind" aria-hidden="true">{dir === 'asc' ? '▲' : '▼'}</span>}</button> : c.h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!res && !error && <tr><td colSpan={cols.length} className="muted pad">Loading…</td></tr>}
            {res && res.items.length === 0 && <tr><td colSpan={cols.length} className="muted pad">{activeFilters.length || q || view ? 'No stations match these filters.' : `No stations in the ${region} region yet. Use "+ Create New Station" to add the first one.`}</td></tr>}
            {res?.items.map((s) => (
              <tr key={s.id}>{cols.map((c) => <td key={c.key} className={c.num ? 'numeric' : ''}>{c.cell(s, { onDelete })}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)}>Previous</button>
        <span>{res ? `Page ${res.page} of ${pages} · ${res.total.toLocaleString('en-IN')} stations` : ''}</span>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => update({ page: String(page + 1) }, false)}>Next</button>
        <select aria-label="Rows per page" value={pageSize} onChange={(e) => update({ size: e.target.value })}>
          {SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
      </div>
    </div>
  );
}

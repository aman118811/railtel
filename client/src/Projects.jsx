import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import { rememberList } from './format.js';

export const PROJECT_TYPES = ['VSS', 'Nirbhaya', 'Combined / Multi-Project', 'Other'];
export const PROJECT_STATUSES = ['Planned', 'Active', 'On Hold', 'Completed', 'Closed'];
const TONE = { Planned: 'grey', Active: 'blue', 'On Hold': 'amber', Completed: 'green', Closed: 'grey' };
export const ProjectStatus = ({ status }) => <span className={`pill pill-${TONE[status] || 'grey'}`}>{status}</span>;

export function ProgressBar({ pct }) {
  return <span className="bar-cell"><span className="bar"><span className="bar-fill tone-green" style={{ width: `${pct}%` }} /></span><b>{pct}%</b></span>;
}

export default function Projects() {
  const { region } = useContext(UserContext);
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const q = get('q'); const type = get('type'); const status = get('status'); const agency = get('agency');
  const sort = get('sort') || 'name'; const dir = get('dir') || 'asc';
  const [search, setSearch] = useState(q);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const update = (patch) => setParams((prev) => {
    const n = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    return n;
  }, { replace: true });

  useEffect(() => { rememberList(`/projects?${params.toString()}`); }, [params]);
  useEffect(() => {
    const t = setTimeout(() => { if (search.trim() !== q) update({ q: search.trim() }); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => {
    let live = true;
    api.projects({ region: 'all', q, type, status, agency, sort, dir }).then((r) => { if (live) setRows(r); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [q, type, status, agency, sort, dir]);

  const th = (key, label, num) => (
    <th className={num ? 'numeric' : ''}>
      <button type="button" className="th-btn" onClick={() => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })}>
        {label}{params.has('sort') && sort === key && <span className="sort-ind" aria-hidden="true">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
  const agencies = useMemo(() => [...new Set((rows || []).map((r) => r.executing_agency).filter(Boolean))], [rows]);

  return (
    <div className="page wide">
      <Breadcrumbs items={[{ label: region }, { label: 'Projects' }]} />
      <div className="list-head">
        <div><h1>Projects</h1><p className="sheet-title">{rows ? `${rows.length} project${rows.length === 1 ? '' : 's'}` : ''}</p></div>
        <div className="list-actions"><Link to="/projects/new" className="btn btn-primary">+ Create New Project</Link></div>
      </div>

      <div className="filters">
        <input type="search" placeholder="Search project, type or agency" aria-label="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Project type" value={type} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All types</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>{PROJECT_STATUSES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="search" list="agency-list" placeholder="Executing agency" aria-label="Executing agency" value={agency} onChange={(e) => update({ agency: e.target.value })} />
        <datalist id="agency-list">{agencies.map((a) => <option key={a} value={a} />)}</datalist>
      </div>

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="table-wrap">
        <table className="data-table list-table">
          <thead>
            <tr>
              {th('name', 'Project Name')}{th('type', 'Type')}<th>Executing Agency</th>
              {th('stations', 'Stations', true)}{th('commissioned', 'Commissioned', true)}<th className="numeric">In Progress</th>
              {th('hindrance', 'Hindrance', true)}<th className="numeric">Balance</th>{th('progress', 'Progress')}{th('status', 'Status')}<th />
            </tr>
          </thead>
          <tbody>
            {!rows && !error && <tr><td colSpan={11} className="muted pad">Loading…</td></tr>}
            {rows?.length === 0 && (
              <tr><td colSpan={11} className="muted pad">{q || type || status || agency ? 'No projects match these filters.' : `No projects in the ${region} region yet. Use "+ Create New Project" to add one.`}</td></tr>
            )}
            {rows?.map((p) => (
              <tr key={p.id}>
                <td><Link className="name-link strong" to={`/projects/${p.id}`}>{p.name}</Link></td>
                <td>{p.type}</td>
                <td>{p.executing_agency || <span className="muted">—</span>}</td>
                <td className="numeric">{p.stats.total}</td>
                <td className="numeric">{p.stats.commissioned}</td>
                <td className="numeric">{p.stats.in_progress}</td>
                <td className="numeric">{p.stats.hindrance}</td>
                <td className="numeric">{p.stats.balance}</td>
                <td><ProgressBar pct={p.stats.progress} /></td>
                <td><ProjectStatus status={p.status} /></td>
                <td><span className="row-actions"><Link to={`/projects/${p.id}`}>View</Link><Link to={`/projects/${p.id}/edit`}>Edit</Link></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

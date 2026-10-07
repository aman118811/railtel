import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import StatusPill, { LifecyclePill } from './StatusPill.jsx';
import { ProgressBar, ProjectStatus } from './Projects.jsx';
import { fmtDate, fmtDateTime, rememberList } from './format.js';

const TABS = [['stations', 'Stations'], ['progress', 'Progress'], ['reports', 'Reports'], ['activity', 'Activity']];
const nf = (n) => Number(n || 0).toLocaleString('en-IN');
const dash = (v) => (v === null || v === undefined || v === '' ? <span className="not-set">Not set</span> : v);

function LinkExisting({ project, onLinked }) {
  const { user } = useContext(UserContext);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [linked, setLinked] = useState(new Set());
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const [found, mine] = await Promise.all([api.page({ q: q.trim(), pageSize: 8 }), api.page({ project: project.id, q: q.trim(), pageSize: 50 })]);
        if (!live) return;
        setHits(found.items); setLinked(new Set(mine.items.map((s) => s.id)));
      } catch (e) { if (live) setMsg(e.message); }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q, project.id]);

  const link = async (s) => {
    setMsg('');
    try { await api.linkStation(project.id, s.id, user); setLinked((l) => new Set(l).add(s.id)); setMsg(`${s.stn_code} linked.`); onLinked(); }
    catch (e) { setMsg(e.status === 409 ? `${s.stn_code} is already in this project.` : e.message); }
  };

  return (
    <section className="card">
      <h3>Link an existing station</h3>
      <p className="muted small">Search by station code or name. The station is linked, not copied: the same record is used everywhere.</p>
      <input type="search" placeholder="Station code or name (at least 2 letters)" aria-label="Find a station to link" value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <p className="small" role="status">{msg}</p>}
      {hits.length > 0 && (
        <ul className="mini-list">
          {hits.map((s) => (
            <li key={s.id}>
              <span className="mini-main"><b>{s.stn_code}</b> {s.station_name}</span>
              <span className="mini-meta">{s.division || s.zone}</span>
              <span className="mini-extra">
                {linked.has(s.id) ? <span className="muted">Already in this project</span> : <button type="button" className="btn btn-sm" onClick={() => link(s)}>Link to project</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StationsTab({ project, onChanged }) {
  const { user } = useContext(UserContext);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api.page({ project: project.id, q, page, pageSize: 25, sort: 'stn_code' }).then((r) => { if (live) setRes(r); }).catch((e) => { if (live) setError(e.message); });
    }, q ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [project.id, q, page, tick]);

  const unlink = async (s) => {
    if (!window.confirm(`Remove ${s.stn_code} ${s.station_name} from this project? The station itself is not deleted.`)) return;
    try { await api.unlinkStation(project.id, s.id, user); setTick((x) => x + 1); onChanged(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="list-head">
        <input type="search" className="grow-input" placeholder="Search this project's stations" aria-label="Search project stations" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="list-actions">
          <a className="btn" href={api.exportUrl({ project: project.id })} download>Export CSV</a>
          <Link to={`/stations/new?project=${project.id}`} className="btn btn-primary">+ Add Station</Link>
        </div>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="table-wrap">
        <table className="data-table list-table">
          <thead><tr><th>Station Code</th><th>Station Name</th><th>Division</th><th>State</th><th className="numeric">Scope</th><th className="numeric">Done</th><th>Status</th><th>Stage</th><th /></tr></thead>
          <tbody>
            {!res && <tr><td colSpan={9} className="muted pad">Loading…</td></tr>}
            {res?.items.length === 0 && <tr><td colSpan={9} className="muted pad">{q ? 'No stations match.' : 'No stations are linked to this project yet. Add a new station or link an existing one below.'}</td></tr>}
            {res?.items.map((s) => (
              <tr key={s.id}>
                <td><Link className="code-link" to={`/stations/${s.id}/view?project=${project.id}`}>{s.stn_code}</Link></td>
                <td>{s.station_name}</td><td>{dash(s.division)}</td><td>{dash(s.state)}</td>
                <td className="numeric">{s.scope_total ?? 0}</td><td className="numeric">{s.done_total ?? 0}</td>
                <td><StatusPill status={s.status} /></td><td><LifecyclePill value={s.lifecycle} draft={s.draft} /></td>
                <td><span className="row-actions"><Link to={`/stations/${s.id}/view?project=${project.id}`}>View</Link><Link to={`/stations/${s.id}`}>Edit</Link><button type="button" className="link-btn danger" onClick={() => unlink(s)}>Remove</button></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{res ? `Page ${res.page} of ${res.pages} · ${res.total} stations` : ''}</span>
        <button type="button" className="btn" disabled={!res || page >= res.pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <LinkExisting project={project} onLinked={() => { setTick((x) => x + 1); onChanged(); }} />
    </>
  );
}

function ProgressTab({ project }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.list({ project: project.id }).then(setRows).catch(() => setRows([])); }, [project.id]);
  const byDiv = useMemo(() => {
    const m = {};
    for (const s of rows || []) {
      const k = s.division || '—';
      const r = m[k] || (m[k] = { division: k, total: 0, commissioned: 0, dropped: 0, scope: 0, done: 0 });
      r.total += 1; r.scope += Number(s.scope_total) || 0; r.done += Number(s.done_total) || 0;
      if (s.lifecycle === 'Closed') r.dropped += 1; else if (['Completed', 'Go Live'].includes(s.status)) r.commissioned += 1;
    }
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [rows]);
  if (!rows) return <p className="muted">Loading…</p>;
  const st = project.stats;
  return (
    <div className="dash-grid">
      <section className="card">
        <h3>Cameras: scope vs work done</h3>
        <div className="big-num">{nf(st.done_cameras)} <small>of {nf(st.scope_cameras)}</small></div>
        <ProgressBar pct={st.scope_cameras ? Math.min(100, Math.round((st.done_cameras / st.scope_cameras) * 100)) : 0} />
        {project.approved_camera_scope != null && <p className="muted small">Approved for the project: {nf(project.approved_camera_scope)} (official figure, shown separately)</p>}
      </section>
      <section className="card span2">
        <h3>Commissioning by division</h3>
        {byDiv.length === 0 && <p className="muted">No stations.</p>}
        <div className="div-grid">
          {byDiv.map((x) => (
            <div key={x.division} className="div-row">
              <span className="div-name">{x.division}</span>
              <span className="bar"><span className="bar-fill tone-green" style={{ width: `${x.total - x.dropped ? Math.round((x.commissioned / (x.total - x.dropped)) * 100) : 0}%` }} /></span>
              <span className="div-n">{x.commissioned}/{x.total}</span>
              <span className="div-cam muted">{nf(x.done)}/{nf(x.scope)} cams</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Activity({ id }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.projectHistory(id).then(setRows).catch(() => setRows([])); }, [id]);
  if (!rows) return <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="muted">No activity yet.</p>;
  const verb = { create: 'Project created', update: 'Project updated', link: 'Station linked', unlink: 'Station unlinked' };
  return (
    <div className="history">
      {rows.map((h) => (
        <section className="card" key={h.id}>
          <h3><span className={`pill pill-${h.action === 'unlink' ? 'amber' : h.action === 'update' ? 'update' : 'create'}`}>{verb[h.action]}</span> by {h.changed_by}
            {h.station && <Link to={`/stations/${h.station.id}/view`}>{h.station.stn_code} {h.station.station_name}</Link>}
            <small className="muted">{fmtDateTime(h.changed_at)}</small></h3>
          <table className="data-table"><tbody>
            {Object.entries(h.changes).map(([k, c]) => <tr key={k}><td>{k.replace(/_/g, ' ')}</td><td className="muted">{c.from ?? '—'}</td><td>→</td><td>{c.to ?? '—'}</td></tr>)}
          </tbody></table>
        </section>
      ))}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'stations';
  const navigate = useNavigate();
  const { region } = useContext(UserContext);
  const [p, setP] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.project(id).then(setP).catch((e) => setError(e.message));
  useEffect(() => { setP(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rememberList(`/projects/${id}?tab=${tab}`); }, [id, tab]);

  if (error) return <div className="page"><div className="banner banner-error" role="alert">{error}</div></div>;
  if (!p) return <div className="page"><p className="muted">Loading…</p></div>;
  const st = p.stats;
  return (
    <div className="page detail">
      <Breadcrumbs items={[{ label: region }, { label: 'Projects', to: '/projects' }, { label: p.name }]} />
      <header className="detail-head card">
        <div className="dh-top">
          <div className="dh-title"><h1>{p.name}</h1><p className="muted">{p.type}{p.code ? ` · ${p.code}` : ''}{p.executing_agency ? ` · ${p.executing_agency}` : ''}</p></div>
          <div className="dh-actions"><button type="button" className="btn" onClick={() => navigate('/projects')}>← All projects</button><Link to={`/projects/${p.id}/edit`} className="btn btn-primary">Edit</Link></div>
        </div>
        <div className="dh-stats">
          <div><span>Status</span><ProjectStatus status={p.status} /></div>
          <div><span>Progress</span><b>{st.progress}%</b></div>
          <div><span>Stations</span><b>{st.total}</b></div>
          <div><span>Start</span><b>{fmtDate(p.start_date)}</b></div>
          <div><span>Target completion</span><b>{fmtDate(p.target_completion_date)}</b></div>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Project sections">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setParams({ tab: k }, { replace: true })}>{l}</button>)}
      </nav>

      <div className="tab-body">
        {tab === 'stations' && <StationsTab project={p} onChanged={load} />}
        {tab === 'progress' && <ProgressTab project={p} />}
        {tab === 'reports' && (
          <section className="card">
            <h3>Project report</h3>
            <table className="data-table cmp-table"><tbody>
              {[['Total stations', st.total], ['Commissioned', st.commissioned], ['In progress', st.in_progress], ['Hindrance', st.hindrance], ['Handover pending', st.handover_pending], ['Dropped', st.dropped], ['Balance', st.balance], ['Cameras in scope', nf(st.scope_cameras)], ['Cameras done', nf(st.done_cameras)], ['Progress', `${st.progress}%`]].map(([k, v]) => <tr key={k}><td>{k}</td><td className="numeric">{v}</td></tr>)}
            </tbody></table>
            <p className="list-actions"><a className="btn btn-primary" href={api.exportUrl({ project: p.id })} download>Export stations (CSV)</a><button type="button" className="btn" onClick={() => window.print()}>Print</button></p>
          </section>
        )}
        {tab === 'activity' && <Activity id={p.id} />}
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from './api.js';
import { LifecyclePill } from './StatusPill.jsx';
import { fmtDate, fmtDateTime } from './format.js';

const nf = (n) => Number(n || 0).toLocaleString('en-IN');

const PALETTE = ['#0e7490', '#0891b2', '#22a6c9', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#7c3aed', '#64748b', '#94a3b8'];
const GREEN = '#16a34a';
const BLUE = '#0e7490';
const SKY = '#38bdf8';
const AMBER = '#f59e0b';
const GREY = '#cbd5e1';
const GRID = '#e2e8f0';
const AXIS = { fontSize: 12, fill: '#475569' };
const PROJECT_STATUS_COLOR = { Planned: '#94a3b8', Active: BLUE, 'On Hold': AMBER, Completed: GREEN, Closed: '#64748b' };

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && label !== "" && <div className="chart-tip-h">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="chart-tip-r">
          <i style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span><b>{nf(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

function Donut({ data, center, centerLabel, height = 210 }) {
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={height * 0.31} outerRadius={height * 0.45} paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={d.name} fill={d.fill || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><b>{center}</b><span>{centerLabel}</span></div>
    </div>
  );
}

function HBar({ data, color, labelWidth = 130 }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36 + 8)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 30, top: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={labelWidth} tick={AXIS} tickLine={false} axisLine={false} interval={0} />
        <Tooltip cursor={{ fill: '#f1f5f9' }} content={<Tip />} />
        <Bar dataKey="count" name="Stations" fill={color} radius={[0, 5, 5, 0]} barSize={18}
          label={{ position: 'right', fontSize: 12.5, fontWeight: 700, fill: '#0f172a' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Legend2({ items }) {
  return (
    <ul className="legend-list">
      {items.map((s) => <li key={s.name}><i style={{ background: s.fill }} /><span>{s.name}</span><b>{nf(s.value)}</b></li>)}
    </ul>
  );
}

function StationRows({ rows, extra, empty }) {
  if (!rows.length) return <p className="muted pad">{empty}</p>;
  return (
    <ul className="mini-list">
      {rows.slice(0, 7).map((r) => (
        <li key={r.id}>
          <Link to={`/stations/${r.id}/view`} className="mini-main"><b>{r.stn_code}</b> {r.station_name}</Link>
          <span className="mini-meta">{r.division || r.zone}</span>
          <span className="mini-extra">{extra(r)}</span>
        </li>
      ))}
    </ul>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

/** Why a project needs a look (overdue, hindrances, not started); empty when nothing is wrong. */
function attention(p) {
  if (['Completed', 'Closed'].includes(p.status)) return [];
  const out = [];
  const s = p.stats;
  if (p.target_completion_date && p.target_completion_date < today() && s.progress < 100) out.push(`Past target ${fmtDate(p.target_completion_date)}`);
  if (s.hindrance > 0) out.push(`${nf(s.hindrance)} station${s.hindrance > 1 ? 's' : ''} in hindrance`);
  if (s.handover_pending > 0) out.push(`${nf(s.handover_pending)} awaiting handover`);
  if (s.total === 0) out.push('No stations linked yet');
  return out;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([api.dashboard(), api.projects()]).then(([dash, prj]) => { setD(dash); setProjects(prj); }).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page"><div className="banner banner-error" role="alert">Could not load the dashboard: {error}</div></div>;
  if (!d || !projects) return <div className="page"><p className="muted">Loading…</p></div>;

  const t = d.totals;
  const linked = projects.reduce((s, p) => s + p.stats.total, 0);
  const unlinked = Math.max(0, t.stations - linked);
  const activeProjects = projects.filter((p) => p.status === 'Active').length;
  const camPct = t.scope_cameras ? Math.round((t.done_cameras / t.scope_cameras) * 100) : 0;
  const commPct = t.stations ? Math.round((t.commissioned / t.stations) * 100) : 0;

  const cards = [
    { n: projects.length, l: 'Projects', sub: `${activeProjects} active`, to: '/projects', tone: 'blue' },
    { n: t.stations, l: 'Stations', sub: `${nf(linked)} in projects`, to: '/stations', tone: 'blue' },
    { n: t.commissioned, l: 'Commissioned', sub: `${commPct}% of stations`, to: '/stations?view=commissioned', tone: 'green' },
    { n: t.in_progress, l: 'In progress', sub: 'survey to offered', to: '/stations?view=in_progress', tone: 'blue' },
    { n: t.hindrance, l: 'Hindrance', sub: 'on hold', to: '/stations?view=hindrance', tone: 'red' },
    { n: t.handover_pending, l: 'Handover pending', sub: 'commissioned, not handed over', to: '/stations?view=handover_pending', tone: 'amber' },
  ];

  const projectBars = projects.map((p) => ({
    name: p.name.length > 26 ? `${p.name.slice(0, 25)}…` : p.name, id: p.id,
    Commissioned: p.stats.commissioned, 'In progress': p.stats.in_progress, Hindrance: p.stats.hindrance,
    Other: Math.max(0, p.stats.total - p.stats.commissioned - p.stats.in_progress - p.stats.hindrance),
  }));
  const projStatus = Object.entries(projects.reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {}))
    .map(([name, value]) => ({ name, value, fill: PROJECT_STATUS_COLOR[name] || '#94a3b8' }));
  const flagged = projects.map((p) => ({ p, why: attention(p) })).filter((x) => x.why.length);
  const stageData = d.by_lifecycle.filter((x) => x.count > 0).map((x, i) => ({ name: x.name, value: x.count, fill: PALETTE[i % PALETTE.length] }));
  const camData = [
    { name: 'Installed', value: t.done_cameras, fill: GREEN },
    { name: 'Balance', value: Math.max(0, t.scope_cameras - t.done_cameras), fill: '#e2e8f0' },
  ];
  const hindData = d.hindrance_summary.map((x) => ({ name: x.name, count: x.count }));
  const divData = d.by_division.map((x) => ({
    name: x.division, Commissioned: x.commissioned, Remaining: Math.max(0, x.total - x.commissioned),
  }));

  return (
    <div className="page wide dash">
      <div className="list-head">
        <div>
          <h1>Project Dashboard</h1>
          <p className="sheet-title">
            {projects.length} project{projects.length === 1 ? '' : 's'} · {nf(t.stations)} stations
            {t.drafts > 0 && <> · <Link to="/stations?view=drafts">{t.drafts} draft{t.drafts > 1 ? 's' : ''}</Link></>}
          </p>
        </div>
      </div>

      <div className="tiles six">
        {cards.map((c) => (
          <Link key={c.l} to={c.to} className={`tile tile-link tone-${c.tone}`}>
            <span className="tile-n">{nf(c.n)}</span><span className="tile-l">{c.l}</span><span className="tile-s">{c.sub}</span>
          </Link>
        ))}
      </div>

      {unlinked > 0 && (
        <div className="callout">
          <b>{nf(unlinked)} stations are not linked to any project.</b>
          <span>They are missing from project progress. </span>
          <Link to="/stations?project=none">Review them →</Link>
        </div>
      )}

      <section className="card">
        <h3>Project portfolio <Link to="/projects" className="more">All projects →</Link></h3>
        <div className="table-wrap">
          <table className="portfolio">
            <thead>
              <tr><th>Project</th><th>Type</th><th>Status</th><th className="pnum">Stations</th><th className="pnum">Commissioned</th>
                <th className="pnum">In progress</th><th className="pnum">Hindrance</th><th className="prog-col">Progress</th><th>Target</th></tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="clickable">
                  <td><Link to={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()}><b>{p.name}</b></Link></td>
                  <td>{p.type}</td>
                  <td><span className="chip-dot" style={{ background: PROJECT_STATUS_COLOR[p.status] }} />{p.status}</td>
                  <td className="pnum">{nf(p.stats.total)}</td>
                  <td className="pnum">{nf(p.stats.commissioned)}</td>
                  <td className="pnum">{nf(p.stats.in_progress)}</td>
                  <td className="pnum">{nf(p.stats.hindrance)}</td>
                  <td className="prog-col">
                    <div className="prog"><div className="prog-bar"><div style={{ width: `${p.stats.progress}%` }} /></div><b>{p.stats.progress}%</b></div>
                  </td>
                  <td>{p.target_completion_date ? fmtDate(p.target_completion_date) : '—'}</td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td colSpan="9" className="muted pad">No projects in this region yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dash-row two">
        <section className="card chart-card">
          <h3>Station status by project</h3>
          <ResponsiveContainer width="100%" height={Math.max(150, projectBars.length * 56 + 40)}>
            <BarChart data={projectBars} layout="vertical" margin={{ left: 4, right: 12, top: 0, bottom: 0 }}
              onClick={(e) => { const row = e?.activePayload?.[0]?.payload; if (row) navigate(`/projects/${row.id}`); }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={170} tick={AXIS} tickLine={false} axisLine={false} interval={0} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<Tip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Commissioned" stackId="s" fill={GREEN} barSize={26} cursor="pointer" />
              <Bar dataKey="In progress" stackId="s" fill={SKY} cursor="pointer" />
              <Bar dataKey="Hindrance" stackId="s" fill={AMBER} cursor="pointer" />
              <Bar dataKey="Other" stackId="s" fill={GREY} radius={[0, 5, 5, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <h3>Needs attention</h3>
          {flagged.length === 0 && <p className="muted pad">No project needs attention.</p>}
          <ul className="attn-list">
            {flagged.map(({ p, why }) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`}><b>{p.name}</b></Link>
                <span>{why.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="dash-row three">
        <section className="card chart-card">
          <h3>Projects by status</h3>
          <Donut data={projStatus} center={projects.length} centerLabel="projects" />
          <Legend2 items={projStatus} />
        </section>

        <section className="card chart-card">
          <h3>Stations by stage</h3>
          <Donut data={stageData} center={nf(t.stations)} centerLabel="stations" />
          <Legend2 items={stageData} />
        </section>

        <section className="card chart-card">
          <h3>Camera installation</h3>
          <Donut data={camData} center={`${camPct}%`} centerLabel="installed" />
          <div className="stat-split">
            <div><b>{nf(t.done_cameras)}</b><span>Installed</span></div>
            <div><b>{nf(Math.max(0, t.scope_cameras - t.done_cameras))}</b><span>Balance of {nf(t.scope_cameras)}</span></div>
          </div>
        </section>
      </div>

      <div className="dash-row two">
        <section className="card chart-card">
          <h3>Commissioning by division <small className="muted">(stations)</small></h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={divData} margin={{ left: -12, right: 8, top: 6, bottom: 0 }}
              onClick={(e) => e?.activeLabel && navigate(`/stations?division=${encodeURIComponent(e.activeLabel)}`)}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={58} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={<Tip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Commissioned" stackId="a" fill={GREEN} cursor="pointer" />
              <Bar dataKey="Remaining" stackId="a" fill={GREY} radius={[4, 4, 0, 0]} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card chart-card">
          <h3>Top hindrances</h3>
          {hindData.length === 0 ? <p className="muted pad">No hindrances recorded.</p> : <HBar data={hindData.slice(0, 8)} color={AMBER} />}
        </section>
      </div>

      <div className="dash-row three">
        <section className="card">
          <h3>Upcoming target dates</h3>
          <StationRows rows={d.upcoming_targets} empty="No upcoming targets." extra={(r) => fmtDate(r.target)} />
        </section>

        <section className="card">
          <h3>Handover pending <Link to="/stations?view=handover_pending" className="more">View all →</Link></h3>
          <StationRows rows={d.handover_pending_list} empty="Nothing pending." extra={(r) => <LifecyclePill value={r.lifecycle} />} />
        </section>

        <section className="card">
          <h3>Recent activity</h3>
          <StationRows rows={d.recent_updates} empty="No updates yet." extra={(r) => `${r.updated_by || ''} · ${fmtDateTime(r.updated_at)}`} />
        </section>
      </div>
    </div>
  );
}

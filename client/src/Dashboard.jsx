import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import { LifecyclePill } from './StatusPill.jsx';
import { fmtDate, fmtDateTime } from './format.js';

const nf = (n) => Number(n || 0).toLocaleString('en-IN');

function Bar({ value, max, tone = 'primary' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="bar"><div className={`bar-fill tone-${tone}`} style={{ width: `${pct}%` }} /></div>;
}

function StationRows({ rows, extra, empty }) {
  if (!rows.length) return <p className="muted pad">{empty}</p>;
  return (
    <ul className="mini-list">
      {rows.map((r) => (
        <li key={r.id}>
          <Link to={`/stations/${r.id}/view`} className="mini-main"><b>{r.stn_code}</b> {r.station_name}</Link>
          <span className="mini-meta">{r.division || r.zone}</span>
          <span className="mini-extra">{extra(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { region } = useContext(UserContext);
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="page"><div className="banner banner-error" role="alert">Could not load the dashboard: {error}</div></div>;
  if (!d) return <div className="page"><p className="muted">Loading…</p></div>;

  const t = d.totals;
  const cards = [
    { n: t.stations, l: 'Total stations', to: '/stations', tone: 'blue' },
    { n: t.commissioned, l: 'Commissioned', to: '/stations?view=commissioned', tone: 'green' },
    { n: t.in_progress, l: 'In progress', to: '/stations?view=in_progress', tone: 'blue' },
    { n: t.hindrance, l: 'Hindrance', to: '/stations?view=hindrance', tone: 'red' },
    { n: t.handover_pending, l: 'Handover pending', to: '/stations?view=handover_pending', tone: 'amber' },
  ];
  const camPct = t.scope_cameras ? Math.round((t.done_cameras / t.scope_cameras) * 100) : 0;
  const maxDiv = Math.max(1, ...d.by_division.map((x) => x.total));
  const maxLife = Math.max(1, ...d.by_lifecycle.map((x) => x.count));
  const maxStatus = Math.max(1, ...d.by_status.map((x) => x.count));
  const maxHind = Math.max(1, ...d.hindrance_summary.map((x) => x.count));

  return (
    <div className="page wide dash">
      <div className="list-head">
        <div>
          <h1>{region} CCTV Dashboard</h1>
          <p className="sheet-title">
            {d.by_zone.map((z) => `${z.name} ${z.count}`).join(' · ')}
            {t.drafts > 0 && <> · <Link to="/stations?view=drafts">{t.drafts} draft{t.drafts > 1 ? 's' : ''}</Link></>}
          </p>
        </div>
        <div className="list-actions"><Link to="/stations/new" className="btn btn-primary">+ Create New Station</Link></div>
      </div>

      <div className="tiles">
        {cards.map((c) => (
          <Link key={c.l} to={c.to} className={`tile tile-link tone-${c.tone}`}>
            <span className="tile-n">{nf(c.n)}</span><span className="tile-l">{c.l}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <h3>Camera scope vs work done</h3>
          <div className="big-num">{nf(t.done_cameras)} <small>of {nf(t.scope_cameras)} cameras ({camPct}%)</small></div>
          <Bar value={t.done_cameras} max={t.scope_cameras} />
          <p className="muted small">Totals are the sum of each station's approved scope and work done.</p>
        </section>

        <section className="card">
          <h3>Stations by stage</h3>
          {d.by_lifecycle.map((x) => (
            <div className="bar-row" key={x.name}><span>{x.name}</span><Bar value={x.count} max={maxLife} tone="blue" /><b>{x.count}</b></div>
          ))}
        </section>

        <section className="card">
          <h3>Stations by status <small className="muted">(as in the sheet)</small></h3>
          {d.by_status.map((x) => (
            <div className="bar-row" key={x.name}><span title={x.name}>{x.name}</span><Bar value={x.count} max={maxStatus} tone="grey" /><b>{x.count}</b></div>
          ))}
        </section>

        <section className="card span2">
          <h3>Commissioning progress by division</h3>
          <div className="div-grid">
            {d.by_division.map((x) => (
              <Link key={x.division} to={`/stations?division=${encodeURIComponent(x.division)}`} className="div-row">
                <span className="div-name">{x.division}</span>
                <Bar value={x.commissioned} max={x.total} tone="green" />
                <span className="div-n">{x.commissioned}/{x.total}</span>
                <span className="div-cam muted">{nf(x.done)}/{nf(x.scope)} cams</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Hindrance summary</h3>
          {d.hindrance_summary.length === 0 && <p className="muted pad">No hindrances recorded.</p>}
          {d.hindrance_summary.map((x) => (
            <div className="bar-row" key={x.name}><span title={x.name}>{x.name}</span><Bar value={x.count} max={maxHind} tone="red" /><b>{x.count}</b></div>
          ))}
        </section>

        <section className="card">
          <h3>Upcoming target dates</h3>
          <StationRows rows={d.upcoming_targets} empty="No upcoming targets." extra={(r) => fmtDate(r.target)} />
        </section>

        <section className="card">
          <h3>Handover pending <Link to="/stations?view=handover_pending" className="more">View all →</Link></h3>
          <StationRows rows={d.handover_pending_list} empty="Nothing pending." extra={(r) => <LifecyclePill value={r.lifecycle} />} />
        </section>

        <section className="card span2">
          <h3>Recent updates</h3>
          <StationRows rows={d.recent_updates} empty="No updates yet." extra={(r) => `${r.updated_by || ''} · ${fmtDateTime(r.updated_at)}`} />
        </section>
      </div>
    </div>
  );
}

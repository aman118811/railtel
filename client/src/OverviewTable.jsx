import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SCHEME_SHORT } from '@shared/report.js';
import StatusPill from './StatusPill.jsx';
import { fmtDate } from './format.js';

const dim = (v) => (v ? v : <span className="muted">—</span>);

export const groupKey = (s) => `${s.zone}|${s.division || ''}`;

/** Per Zone/Division group: how many stations, and how many in each status. */
function groupStats(allRows) {
  const stats = {};
  for (const s of allRows) {
    const g = (stats[groupKey(s)] ||= { n: 0, status: {} });
    g.n += 1;
    if (s.status) g.status[s.status] = (g.status[s.status] || 0) + 1;
  }
  return stats;
}

/**
 * The everyday list. When `grouped`, stations sit under their Zone › Division as collapsible groups
 * (a Division is the parent of many stations); otherwise it is a flat list.
 */
export default function OverviewTable({ rows, allRows, loading, grouped, collapsed, onToggle }) {
  const navigate = useNavigate();
  const stats = grouped ? groupStats(allRows) : null;
  let lastGroup = null;

  return (
    <div className="table-wrap">
      <table className="stations overview">
        <thead>
          <tr>
            <th className="stick s1">S.N.</th>
            <th className="stick s2">Stn code</th>
            <th className="stick s3 edge">Name of station</th>
            <th>Z Rly</th>
            <th>Division</th>
            <th>Server thana</th>
            <th>Scheme</th>
            <th>Status</th>
            <th>Cameras done / scope</th>
            <th>Handover</th>
            <th>Target date</th>
            <th>Hindrance</th>
            <th>% filled</th>
            <th><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={14} className="empty">Loading…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={14} className="empty">No stations match these filters.</td></tr>}
          {rows.map((s) => {
            const d = s.data;
            const scope = d.scope_total || 0;
            const done = d.done_total || 0;
            const pct = scope ? Math.min(100, Math.round((done / scope) * 100)) : 0;
            const hind = d.hindrance_type && d.hindrance_type !== 'No Hindrance' ? d.hindrance_type : null;
            const key = groupKey(s);
            const showHeader = grouped && key !== lastGroup;
            lastGroup = key;
            const isCollapsed = grouped && collapsed.has(key);
            const g = stats?.[key];
            return (
              <Fragment key={s.id}>
                {showHeader && (
                  <tr className="group-row">
                    <td colSpan={14}>
                      <div className="group-inner">
                        <button type="button" className="group-btn" aria-expanded={!collapsed.has(key)} onClick={() => onToggle(key)}>
                          <span className="chev" aria-hidden="true">▾</span>
                          <span className="group-zone">{s.zone}</span>
                          <span className="group-sep" aria-hidden="true">›</span>
                          <b>{s.division || 'No division'}</b>
                          <span className="group-count">{g.n} station{g.n === 1 ? '' : 's'}</span>
                        </button>
                        <span className="group-status">
                          {Object.entries(g.status).map(([st, n]) => <span key={st}>{n} {st}</span>)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isCollapsed && (
                  <tr className="clickable" onClick={() => navigate(`/stations/${s.id}/view`)}>
                    <td className="stick s1">{s.sn}</td>
                    <td className="stick s2"><span className="code-badge">{s.stn_code}</span></td>
                    <td className="stick s3 edge"><Link to={`/stations/${s.id}/view`} onClick={(e) => e.stopPropagation()}>{s.station_name}</Link></td>
                    <td>{s.zone}</td>
                    <td>{dim(s.division)}</td>
                    <td>{dim(d.server_thana)}</td>
                    <td>{dim(SCHEME_SHORT[d.scheme] || d.scheme)}</td>
                    <td><StatusPill status={s.status} /></td>
                    <td>
                      <div className="cams">
                        <span>{done} / {scope}</span>
                        <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                      </div>
                    </td>
                    <td>{dim(d.handed_over)}</td>
                    <td>{dim(d.target_commission_date ? fmtDate(d.target_commission_date) : null)}</td>
                    <td>{hind ? <span className="pill pill-amber">{hind}</span> : <span className="muted">—</span>}</td>
                    <td>{s.pct}%</td>
                    <td><Link to={`/stations/${s.id}`} className="edit-link" onClick={(e) => e.stopPropagation()}>Edit</Link></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

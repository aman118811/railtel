import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  SECTIONS, FIELD_BY_KEY, LIFECYCLE, applyComputed, isEmpty, isVisible, overallProgress, sectionProgress,
} from '@shared/fields.js';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import StatusPill, { LifecyclePill } from './StatusPill.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import { compareQty, fmtDate, fmtDateTime, FLAG_LABEL, isCommissioned, lastListPath } from './format.js';

const TABS = [
  ['master', 'Station Master'], ['projects', 'Project Association'], ['scope', 'Approved Scope'], ['done', 'Work Done'],
  ['phase1', 'Non-STQC Phase-I'], ['commissioning', 'Commissioning & Handover'], ['survey', 'Survey / Infrastructure'],
  ['bandwidth', 'Bandwidth'], ['history', 'Audit / Change History'],
];
const MAIN_STAGES = LIFECYCLE.filter((s) => !['On Hold / Hindrance', 'Closed'].includes(s));
const SECTION = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

function show(def, v) {
  if (isEmpty(v)) return <span className="not-set">Not set</span>;
  if (def?.type === 'date') return fmtDate(v);
  return String(v);
}

/** A card of label/value pairs, each tagged with its Excel column so the source stays traceable. */
function KV({ title, keys, d, hideEmpty = false }) {
  const defs = keys.map((k) => FIELD_BY_KEY[k]).filter(Boolean);
  return (
    <section className="card">
      {title && <h3>{title}</h3>}
      <dl className="kv one">
        {defs.filter((f) => !hideEmpty || !isEmpty(d[f.key])).map((f) => (
          <div key={f.key}><dt>{f.label}<span className="col-tag" title="Excel column">{f.col}</span></dt><dd>{show(f, d[f.key])}</dd></div>
        ))}
      </dl>
    </section>
  );
}

const QTY = [
  ['Total cameras', 'scope_total', 'done_total'], ['Dome', 'scope_dome', 'done_dome'], ['Fixed', 'scope_fixed', 'done_fixed'],
  ['PTZ', 'scope_ptz', 'done_ptz'], ['4K', 'scope_k4', 'done_k4'], ['Yard cameras', 'scope_yard', 'done_yard'],
  ['Panic buttons', 'scope_panic', 'done_panic'], ['VA cameras', 'scope_va', 'done_va'], ['FRS cameras', 'scope_frs', 'done_frs'],
];

function ApprovedVsDone({ d }) {
  const commissioned = isCommissioned(d.status);
  return (
    <section className="card">
      <h3>Approved vs Work Done</h3>
      <div className="table-wrap">
        <table className="data-table cmp-table">
          <thead><tr><th>Component</th><th className="numeric">Approved Scope</th><th className="numeric">Work Done</th><th className="numeric">Variance</th><th>Progress</th><th>Flag</th></tr></thead>
          <tbody>
            {QTY.map(([label, sk, dk]) => {
              const c = compareQty(d[sk], d[dk], commissioned);
              const s = FIELD_BY_KEY[sk]; const w = FIELD_BY_KEY[dk];
              return (
                <tr key={sk} className={label === 'Total cameras' ? 'total-row' : ''}>
                  <td>{label}<span className="col-tag">{s.col}/{w.col}</span></td>
                  <td className="numeric">{c.s ?? '—'}</td>
                  <td className="numeric">{c.d ?? '—'}</td>
                  <td className={`numeric var-${c.flag}`}>{c.variance === null ? '—' : (c.variance > 0 ? `+${c.variance}` : c.variance)}</td>
                  <td>{c.pct === null ? <span className="muted">—</span> : <span className="bar-cell"><span className="bar"><span className={`bar-fill tone-${c.flag === 'over' ? 'amber' : c.flag === 'shortfall' ? 'red' : 'green'}`} style={{ width: `${c.pct}%` }} /></span><b>{c.pct}%</b></span>}</td>
                  <td>{c.flag === 'none' ? <span className="muted">—</span> : <span className={`flag flag-${c.flag}`}>{FLAG_LABEL[c.flag]}</span>}</td>
                </tr>
              );
            })}
            <tr>
              <td>Cameras STQC compliant<span className="col-tag">Y/AJ</span></td>
              <td className="numeric">{show(null, d.scope_stqc)}</td><td className="numeric">{show(null, d.done_stqc)}</td><td /><td /><td />
            </tr>
            <tr>
              <td>OEM of cameras<span className="col-tag">Z/AK</span></td>
              <td className="numeric">{show(null, d.scope_oem)}</td><td className="numeric">{show(null, d.done_oem)}</td><td /><td /><td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">Variance = Work Done − Approved. Shortfall is flagged only once the station is Completed / Go Live. The stored values are not changed.</p>
    </section>
  );
}

function SurveySection({ section, d }) {
  const p = sectionProgress(section, d);
  return (
    <details className="card fold" open={section.id === 'survey'}>
      <summary><b>{section.title}</b> <span className="muted">{section.subtitle}</span> <span className="count-badge">{p.filled}/{p.total}</span></summary>
      {section.blocks.map((b) => (
        <div key={b.title} className="cmp-block">
          <h4 className="subhead">{b.title}</h4>
          <table className="data-table cmp-table">
            <thead><tr><th>Item</th><th>Scope / Block 1</th><th>Actual / Block 2</th><th>Match</th></tr></thead>
            <tbody>
              {b.items.map((it) => {
                const a = it.scope ? d[it.scope.key] : undefined;
                const c = it.actual ? d[it.actual.key] : undefined;
                const both = !isEmpty(a) && !isEmpty(c);
                return (
                  <tr key={it.key}>
                    <td>{it.label}<span className="col-tag">{it.scope?.col || '—'}/{it.actual?.col || '—'}</span></td>
                    <td>{it.scope ? show(it.scope, a) : <span className="muted">—</span>}</td>
                    <td>{it.actual ? show(it.actual, c) : <span className="muted">—</span>}</td>
                    <td>{both ? (String(a) === String(c) ? <span className="ok-mark">✓</span> : <span className="diff-mark">≠</span>) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </details>
  );
}

function History({ id }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.history(id).then(setRows).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="banner banner-error">{err}</div>;
  if (!rows) return <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="muted">No changes recorded.</p>;
  return (
    <div className="history">
      {rows.map((h) => (
        <section className="card" key={h.id}>
          <h3><span className={`pill pill-${h.action}`}>{h.action === 'create' ? 'Created' : 'Updated'}</span> by {h.changed_by} <small className="muted">{fmtDateTime(h.changed_at)}</small></h3>
          {Object.keys(h.changes).length === 0 ? <p className="muted">No field changes.</p> : (
            <table className="data-table">
              <tbody>
                {Object.entries(h.changes).map(([k, c]) => (
                  <tr key={k}><td>{FIELD_BY_KEY[k]?.label || k}</td><td className="muted">{isEmpty(c.from) ? '—' : String(c.from)}</td><td>→</td><td>{isEmpty(c.to) ? '—' : String(c.to)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}

// Which edit-form section each tab opens (the form is the same one used for every station).
const EDIT_SECTION = { master: 'station', scope: 'scope', done: 'done', phase1: 'phase1', commissioning: 'commission', survey: 'survey', bandwidth: 'bandwidth' };

function ProjectCards({ id }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.stationProjects(id).then(setRows).catch(() => setRows([])); }, [id]);
  if (!rows) return <p className="muted">Loading…</p>;
  if (!rows.length) return <section className="card"><h3>Project Association</h3><p className="muted">This station is not linked to any project. Open a project and use “Link an existing station” on its Stations tab.</p></section>;
  return (
    <div className="dash-grid">
      {rows.map((p) => (
        <section className="card" key={p.project_id}>
          <h3><Link to={`/projects/${p.project_id}`}>{p.name}</Link></h3>
          <dl className="kv">
            <div><dt>Project status</dt><dd>{p.status}</dd></div>
            <div><dt>Relationship</dt><dd>{p.relationship_type}</dd></div>
            <div><dt>Original Excel value</dt><dd>{p.source_project_value || <span className="not-set">Linked in the app</span>}</dd></div>
            <div><dt>Linked</dt><dd>{fmtDateTime(p.linked_at)} by {p.linked_by}</dd></div>
          </dl>
        </section>
      ))}
    </div>
  );
}

export default function StationDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'master';
  const fromProject = params.get('project');
  const navigate = useNavigate();
  const { user, region } = useContext(UserContext);
  const [fromProjectName, setFromProjectName] = useState('');
  const [projs, setProjs] = useState([]);
  useEffect(() => { api.stationProjects(id).then(setProjs).catch(() => {}); }, [id]);
  useEffect(() => { if (fromProject) api.project(fromProject).then((p) => setFromProjectName(p.name)).catch(() => {}); }, [fromProject]);
  const [rec, setRec] = useState(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true;
    setRec(null);
    api.get(id).then((r) => { if (live) { setRec(r); setStage(r.lifecycle || ''); } }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id]);

  const d = useMemo(() => (rec ? applyComputed(rec.data) : null), [rec]);
  const overall = useMemo(() => (d ? overallProgress(d) : null), [d]);

  if (error) return <div className="page"><div className="banner banner-error" role="alert">{error}</div></div>;
  if (!rec || !d) return <div className="page"><p className="muted">Loading…</p></div>;

  const cam = compareQty(d.scope_total, d.done_total, isCommissioned(d.status));
  const saveStage = async () => {
    try {
      const r = await api.update(rec.id, {}, user, rec.updated_at, { lifecycle: stage });
      setRec(r); setMsg('Stage saved.');
    } catch (e) { setMsg(e.message); }
  };
  const setTab = (t) => setParams(fromProject ? { tab: t, project: fromProject } : { tab: t }, { replace: true });
  const editTo = rec.draft ? `/stations/${rec.id}/draft` : `/stations/${rec.id}?section=${EDIT_SECTION[tab] || 'station'}`;
  const crumbs = fromProject
    ? [{ label: region }, { label: 'Projects', to: '/projects' }, { label: fromProjectName || 'Project', to: `/projects/${fromProject}?tab=stations` }, { label: rec.stn_code }]
    : [{ label: region }, { label: 'Stations', to: '/stations' }, { label: rec.stn_code }];
  const phase1On = d.has_phase1 === 'Y';
  const stageIdx = MAIN_STAGES.indexOf(rec.lifecycle);
  const hasHindrance = rec.lifecycle === 'On Hold / Hindrance' || ['hindrance_type', 'hindrance_available_date'].some((k) => !isEmpty(d[k]));

  return (
    <div className="page detail">
      <Breadcrumbs items={crumbs} />
      <header className="detail-head card">
        <div className="dh-top">
          <span className="code-badge big">{rec.stn_code}</span>
          <div className="dh-title">
            <h1>{rec.station_name}</h1>
            <p className="muted">{[rec.zone, rec.division, d.state].filter(Boolean).join(' · ')}{rec.origin === 'excel_import' ? ' · imported from Excel' : ''}</p>
          </div>
          <div className="dh-actions">
            <button type="button" className="btn" onClick={() => navigate(lastListPath())}>← Back to list</button>
            <button type="button" className="btn btn-danger" onClick={async () => {
              if (!window.confirm(`Delete station ${rec.stn_code} ${rec.station_name}?\n\nIt is removed from the list and from its projects. A copy is kept in the database archive.`)) return;
              try { await api.deleteStation(rec.id, user); navigate(lastListPath(), { replace: true }); } catch (e) { setMsg(e.message); }
            }}>Delete</button>
            <Link to={rec.draft ? `/stations/${rec.id}/draft` : `/stations/${rec.id}`} className="btn btn-primary">{rec.draft ? 'Continue draft' : 'Edit'}</Link>
          </div>
        </div>
        <div className="dh-stats">
          <div><span>Project(s)</span><b>{projs.length ? projs.map((p, i) => <span key={p.project_id}>{i > 0 && ', '}<Link to={`/projects/${p.project_id}`}>{p.name}</Link></span>) : '—'}</b></div>
          <div><span>Data completeness</span><b>{overall.pct}%</b><span className="bar thin"><span className="bar-fill tone-blue" style={{ width: `${overall.pct}%` }} /></span></div>
          <div><span>Status</span><StatusPill status={rec.status} /></div>
          <div><span>Stage</span><LifecyclePill value={rec.lifecycle} draft={rec.draft} /></div>
          <div><span>Commissioned</span><b>{isCommissioned(rec.status) ? 'Yes' : 'No'}</b></div>
          <div><span>Handover</span><b>{d.handed_over || '—'}</b></div>
          <div><span>Target date</span><b>{fmtDate(d.target_commission_date)}</b></div>
          <div><span>Cameras</span><b>{d.done_total ?? 0} / {d.scope_total ?? 0}</b></div>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Station sections">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </nav>

      <div className="tab-body">
        {EDIT_SECTION[tab] && !rec.draft && (
          <div className="tab-edit"><Link to={editTo} className="btn btn-sm">Edit this section</Link></div>
        )}
        {tab === 'projects' && <ProjectCards id={rec.id} />}
        {tab === 'master' && (
          <div className="dash-grid">
            <KV title="Station identity" keys={['sn', 'stn_code', 'station_name', 'new_beyond_scope']} d={d} />
            <KV title="Jurisdiction & thana" keys={['server_thana', 'server_thana_code', 'monitoring_thana', 'monitoring_thana_code']} d={d} />
            <KV title="Railway hierarchy" keys={['zone', 'division', 'state']} d={d} />
            <KV title="Classification & specs" keys={['phase1', 'old_category', 'new_category', 'rdso_spec']} d={d} />
          </div>
        )}

        {tab === 'scope' && (
          <div className="dash-grid">
            <KV title="CCTV cameras" keys={['scope_total', 'scope_dome', 'scope_fixed', 'scope_ptz', 'scope_k4', 'scope_yard']} d={d} />
            <KV title="Features" keys={['scope_panic', 'scope_va', 'scope_frs', 'scope_stqc', 'scope_oem']} d={d} />
          </div>
        )}

        {tab === 'done' && (
          <>
            <ApprovedVsDone d={d} />
            <div className="dash-grid">
              <KV title="Installation" keys={['install_month', 'install_year', 'status']} d={d} />
            </div>
          </>
        )}

        {tab === 'phase1' && (phase1On ? (
          <div className="dash-grid">
            <KV title="Cameras" keys={['p1_total', 'p1_dome', 'p1_fixed', 'p1_ptz', 'p1_k4', 'p1_yard']} d={d} />
            <KV title="Features & installation" keys={['p1_panic', 'p1_va', 'p1_frs', 'p1_oem', 'p1_month', 'p1_year']} d={d} />
          </div>
        ) : (
          <section className="card"><h3>Non-STQC Phase-I</h3><p className="muted">This station has no Non-STQC (Phase-1) cameras, so these fields are not applicable. Turn it on from Edit if that is wrong.</p></section>
        ))}

        {tab === 'commissioning' && (
          <div className="dash-grid">
            <KV title="Commissioning" keys={['status', 'scheme', 'target_commission_date', 'install_month', 'install_year']} d={d} />
            <KV title="Handover" keys={['handed_over', 'handover_date', 'handover_target']} d={d} />
            <KV title="Hindrance" keys={['hindrance_type', 'hindrance_available_date']} d={d} />
            <KV title="Remarks" keys={['remarks']} d={d} />
          </div>
        )}

        {tab === 'survey' && ['survey', 'active', 'passive', 'other'].map((id2) => <SurveySection key={id2} section={SECTION[id2]} d={d} />)}

        {tab === 'bandwidth' && (
          <div className="dash-grid"><KV title="Bandwidth" keys={['bw_capacity', 'bw_sanctioned', 'bw_commission_date']} d={d} /></div>
        )}

        {tab === 'history' && <History id={rec.id} />}
      </div>
    </div>
  );
}

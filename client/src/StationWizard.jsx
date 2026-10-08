import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs.jsx';
import {
  REGIONS, SECTIONS, FIELDS, FIELD_BY_KEY, ZONE_DIVISIONS, applyComputed, defaultsFor, isEmpty, isVisible, overallProgress, sameValue, validate,
} from '@shared/fields.js';
import { lookupStation, STATIONS_MASTER } from '@shared/stationsMaster.js';
import { api } from './api.js';
import { UserContext, REGION_NAMES } from './App.jsx';
import Field from './Field.jsx';
import CompareSection from './CompareSection.jsx';
import { fmtDate, lastListPath } from './format.js';

const STATION_OPTIONS = STATIONS_MASTER.map((m) => ({ value: m.name, label: m.name, search: `${m.name} ${m.code}`, hint: `${m.code} · ${m.division} · ${m.state}`, item: m }));
const zoneOfDivision = (div) => Object.keys(ZONE_DIVISIONS).find((z) => ZONE_DIVISIONS[z].includes(div)) || null;
const low = (v) => String(v ?? '').trim().toLowerCase();

const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
const EDITABLE = FIELDS.filter((f) => f.type !== 'auto' && !f.hidden);
const only = (section, pred) => section.fields.filter(pred);
const outdoor = SEC.survey.blocks[0];
const indoor = SEC.survey.blocks[1];
const pseudo = (id, title, blocks) => ({ id, title, blocks, kind: 'compare', fields: blocks.flatMap((b) => b.items.flatMap((i) => [i.scope, i.actual].filter(Boolean))) });

// The eight steps (spec section 6). Every form field appears in exactly one step.
const STEPS = [
  { id: 'master', title: 'Station Master', fields: SEC.station.fields },
  { id: 'scope', title: 'Approved Survey / Scope', fields: SEC.scope.fields },
  { id: 'done', title: 'Work Done & Commissioning', fields: [...SEC.done.fields, ...only(SEC.commission, (f) => f.key === 'status')] },
  { id: 'phase1', title: 'Non-STQC Phase-I', fields: SEC.phase1.fields },
  { id: 'handover', title: 'Handover / Hindrance / Targets', fields: only(SEC.commission, (f) => f.key !== 'status'), compare: [pseudo('outdoor', 'Outdoor survey', [outdoor])] },
  { id: 'infra', title: 'Survey & Infrastructure', fields: [], compare: [pseudo('indoor', 'Indoor survey', [indoor]), SEC.active, SEC.passive, SEC.other] },
  { id: 'bandwidth', title: 'Bandwidth', fields: SEC.bandwidth.fields },
  { id: 'review', title: 'Review & Create', fields: [] },
];
const stepOf = (key) => {
  const i = STEPS.findIndex((s) => s.fields.some((f) => f.key === key) || (s.compare || []).some((c) => c.fields.some((f) => f.key === key)));
  return i < 0 ? 0 : i;
};

function Fields({ fields, data, onChange, errors, warnings }) {
  const out = [];
  let last = null;
  for (const f of fields) {
    if (!isVisible(f, data)) continue;
    if (f.group && f.group !== last) out.push(<h4 key={`g-${f.group}`} className="subhead">{f.group}</h4>);
    last = f.group || last;
    out.push(<Field key={f.key} def={f} data={data} onChange={onChange} error={errors[f.key]} warning={warnings[f.key]} />);
  }
  return <div className="grid">{out}</div>;
}

function Review({ view, errors, warnings, goto }) {
  const groups = SECTIONS.map((s) => ({
    s, items: s.fields.filter((f) => f.type !== 'auto' && !f.hidden && isVisible(f, view) && !isEmpty(view[f.key])),
  })).filter((g) => g.items.length);
  const missing = [...new Set([...Object.keys(errors)])];
  return (
    <>
      {missing.length > 0 ? (
        <div className="banner banner-error" role="alert">
          <b>Fix before creating:</b>
          <ul>{missing.map((k) => <li key={k}><button type="button" className="link-btn" onClick={() => goto(stepOf(k))}>{FIELD_BY_KEY[k]?.label || k}</button> — {errors[k]}</li>)}</ul>
        </div>
      ) : <div className="banner banner-ok">All required information is complete. Review and create.</div>}
      {Object.keys(warnings).length > 0 && (
        <div className="banner banner-warn"><b>Warnings (you can still create):</b>
          <ul>{Object.entries(warnings).map(([k, w]) => <li key={k}>{FIELD_BY_KEY[k]?.label || k}: {w}</li>)}</ul>
        </div>
      )}
      {groups.map(({ s, items }) => (
        <section className="card" key={s.id}>
          <h3>{s.number}. {s.title}</h3>
          <dl className="kv">
            {items.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{f.type === 'date' ? fmtDate(view[f.key]) : String(view[f.key])}</dd></div>)}
          </dl>
        </section>
      ))}
      {groups.length === 0 && <p className="muted">Nothing entered yet.</p>}
    </>
  );
}

export default function StationWizard() {
  const { id: draftId } = useParams(); // present when resuming /stations/:id/draft
  const navigate = useNavigate();
  const { user, region } = useContext(UserContext);
  const [record, setRecord] = useState(null);
  const [original, setOriginal] = useState({});
  const [data, setData] = useState(defaultsFor());
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [loading, setLoading] = useState(!!draftId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [search] = useSearchParams();
  const [projectId, setProjectId] = useState(search.get('project') || '');
  const [projects, setProjects] = useState([]);
  const [linked, setLinked] = useState([]); // projects of an existing draft
  const fromProject = !!search.get('project');
  useEffect(() => { api.projects({ region: 'all', stats: '0' }).then(setProjects).catch(() => {}); }, []);
  // Before the form: 1) choose the project, 2) choose the region. A draft being resumed goes straight to the form.
  const [stage, setStage] = useState(draftId ? 'form' : (search.get('project') ? 'region' : 'project'));
  const [stationRegion, setStationRegion] = useState(region);
  useEffect(() => {
    const p = projects.find((x) => x.id === projectId);
    if (p && stage !== 'form') setStationRegion(p.region);
  }, [projectId, projects, stage]);
  useEffect(() => { if (draftId) api.stationProjects(draftId).then(setLinked).catch(() => {}); }, [draftId]);
  // Skip straight to Station Master when launched from a project (it is already selected and shown).

  useEffect(() => {
    if (!draftId) return;
    api.get(draftId)
      .then((r) => {
        if (!r.draft) { navigate(`/stations/${r.id}`, { replace: true }); return; }
        setRecord(r); setOriginal(r.data); setData(r.data); setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [draftId, navigate]);

  const view = useMemo(() => applyComputed(data), [data]);
  const strict = useMemo(() => validate(view, { strict: true }), [view]);
  const overall = overallProgress(view).pct;
  // Hints learned from the region's existing stations (thanas, codes in use, the standard scope package).
  const [lookups, setLookups] = useState(null);
  useEffect(() => { if (stage === 'form') api.lookups(stationRegion).then(setLookups).catch(() => {}); }, [stage, stationRegion]);
  // "Work done / proposed under" is the chosen project's own sheet text, so fill it once when the form opens.
  useEffect(() => {
    const src = projects.find((p) => p.id === projectId)?.source_values?.[0];
    if (stage === 'form' && !draftId && src) setData((d) => (isEmpty(d.scheme) ? { ...d, scheme: src } : d));
  }, [stage, projectId, projects, draftId]);
  const thanaByName = useMemo(() => new Map((lookups?.thanas || []).map((t) => [low(t.name), t])), [lookups]);
  const thanaNames = useMemo(() => (lookups?.thanas || []).map((t) => t.name), [lookups]);

  // Picking a value fills what follows from it, but only fields that are still empty (the thana code always follows its thana).
  const onChange = (key, value) => setData((d) => {
    const next = { ...d, [key]: value };
    if (key === 'division' && value && isEmpty(d.zone)) next.zone = zoneOfDivision(value) || d.zone;
    if (key === 'server_thana') {
      const t = thanaByName.get(low(value));
      if (t) {
        next.server_thana = t.name;
        if (t.code) next.server_thana_code = t.code;
        if (isEmpty(d.division) && t.division) next.division = t.division;
        if (isEmpty(d.zone) && t.zone) next.zone = t.zone;
        if (isEmpty(d.state) && t.state) next.state = t.state;
      }
    }
    if (key === 'stn_code' && value && isEmpty(d.station_name)) {
      const m = lookupStation(value);
      if (m) Object.assign(next, { station_name: m.name, zone: m.zone, division: m.division, state: m.state, server_thana: m.thana, server_thana_code: m.thanaCode, ...(m.cat ? { old_category: m.cat } : {}) });
    }
    return next;
  });

  const cur = STEPS[step];
  const stepKeys = new Set([...cur.fields.map((f) => f.key), ...(cur.compare || []).flatMap((c) => c.fields.map((f) => f.key))]);
  // Within a step only show problems once the user has tried to move on (and always for the review).
  const stepErrors = (attempted || step === STEPS.length - 1) ? Object.fromEntries(Object.entries(strict.errors).filter(([k]) => stepKeys.has(k) || cur.id === 'review')) : {};
  const stepWarnings = Object.fromEntries(Object.entries(strict.warnings).filter(([k]) => stepKeys.has(k)));
  if (cur.id === 'master' && !record && view.stn_code && view.zone && lookups?.codes.includes(view.zone + ':' + view.stn_code)) {
    stepWarnings.stn_code = 'A station with code ' + view.stn_code + ' already exists in ' + view.zone + '.';
  }
  // Suggestions for the name and thana fields (the field definitions themselves are unchanged).
  // Stations matching what is typed: the built-in directory (instant) plus the region's stations from the database.
  const loadStationOptions = async (q) => {
    const lq = q.toLowerCase();
    let rows = [];
    try { rows = await api.stationNames(q, stationRegion); } catch { /* fall back to the built-in directory */ }
    const added = rows.map((r) => ({
      value: r.name, label: r.name, search: `${r.name} ${r.code}`, badge: 'Added', hint: `${r.code} · ${r.division ?? '—'} · ${r.state ?? '—'}`, item: r,
    }));
    const have = new Set(added.map((o) => `${o.item.zone}:${o.item.code}`));
    const fresh = STATION_OPTIONS.filter((o) => (!lq || o.search.toLowerCase().includes(lq)) && !have.has(`${o.item.zone}:${o.item.code}`));
    return [...fresh, ...added].slice(0, 10);
  };
  const withSuggestions = (f) => {
    if (f.key === 'station_name') {
      return { ...f, type: 'combo', comboOptions: STATION_OPTIONS, loadOptions: loadStationOptions, onPick: applyMaster, placeholder: 'Search stations by name or code, or type a new name' };
    }
    if (['server_thana', 'monitoring_thana'].includes(f.key) && thanaNames.length) return { ...f, type: 'select', allowTyping: true, options: thanaNames };
    return f;
  };
  const scopeEmpty = ['scope_dome', 'scope_fixed', 'scope_ptz', 'scope_k4', 'scope_yard', 'scope_panic', 'scope_va', 'scope_frs'].every((k) => isEmpty(view[k]));
  const pkg = lookups?.standard_scope;

  const identityOk = !isEmpty(view.stn_code) && !isEmpty(view.station_name) && !isEmpty(view.zone);
  // Hard (non-"Required") problems that block even a draft: negative numbers, whole-number rules.
  // Business rules (required-when-commissioned etc.) only block the final Create step, not each step.
  const hard = Object.entries(strict.errors).filter(([, m]) => m === 'Cannot be negative' || m === 'Must be a whole number');

  // Save the station as a draft (create on first save, update afterwards).
  const persist = async ({ finalize = false } = {}) => {
    setBusy(true); setError(''); setNote('');
    try {
      let res;
      if (!record) {
        const payload = Object.fromEntries(EDITABLE.filter((f) => !isEmpty(view[f.key])).map((f) => [f.key, view[f.key]]));
        res = await api.create(payload, user, { draft: !finalize, project_id: projectId || undefined, region: stationRegion });
      } else {
        const base = applyComputed(original);
        const payload = Object.fromEntries(EDITABLE.filter((f) => !sameValue(view[f.key], base[f.key])).map((f) => [f.key, view[f.key] ?? null]));
        res = await api.update(record.id, payload, user, record.updated_at, finalize ? { draft: false } : {});
      }
      setRecord(res); setOriginal(res.data);
      if (!finalize) setNote('Draft saved.');
      return res;
    } catch (e) {
      if (e.status === 409 && e.body?.code === 'duplicate') setError('A station with this zone and code already exists. Change the code or zone.');
      else if (e.status === 409) setError('This station was changed by someone else. Reload the page to get the latest.');
      else if (e.status === 422) {
        const keys = Object.keys(e.body?.errors || {});
        setError(`The server rejected the data: ${keys.map((k) => FIELD_BY_KEY[k]?.label || k).join(', ')}.`);
        if (keys.length) setStep(stepOf(keys[0]));
      } else setError(e.message);
      return null;
    } finally { setBusy(false); }
  };

  const goto = (i) => { setStep(i); setVisited((v) => new Set(v).add(i)); setAttempted(false); window.scrollTo({ top: 0 }); };

  const saveDraft = async () => {
    if (!identityOk) { setAttempted(true); setError('Enter the station code, name and zone before saving a draft.'); setStep(0); return; }
    await persist();
  };
  const next = async () => {
    setAttempted(true);
    if (cur.id === 'master' && !identityOk) { setError('Station code, name and zone are required to continue.'); return; }
    const mine = hard.filter(([k]) => stepKeys.has(k));
    if (mine.length) { setError('Fix the highlighted values to continue.'); return; }
    setError('');
    if (identityOk) { const r = await persist(); if (!r) return; }
    goto(step + 1);
  };
  const create = async () => {
    setAttempted(true);
    if (Object.keys(strict.errors).length) { setError(`${Object.keys(strict.errors).length} item(s) must be fixed before the station can be created.`); return; }
    const r = await persist({ finalize: true });
    if (r) navigate(`/stations/${r.id}/view${projectId ? `?project=${projectId}` : ''}`, { replace: true });
  };

  const applyMaster = (m) => setData((d) => ({
    ...d, station_name: m.name, stn_code: m.code, zone: m.zone, division: m.division, state: m.state, server_thana: m.thana, server_thana_code: m.thanaCode,
    ...(m.cat ? { old_category: m.cat } : {}),
  }));

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;

  if (stage !== 'form') {
    const chosen = projects.find((p) => p.id === projectId);
    return (
      <div className="page choose">
        <Breadcrumbs items={[{ label: 'Stations', to: '/stations' }, { label: 'Create New Station' }]} />
        <div className="list-head">
          <div><h1>Create New Station</h1><p className="sheet-title">{stage === 'project' ? 'Step 1 of 2 · Choose the project' : 'Step 2 of 2 · Choose the region'}</p></div>
          <div className="list-actions"><Link to={lastListPath()} className="btn">Cancel</Link></div>
        </div>
        {stage === 'project' ? (
          <section className="card">
            <h2>Which project does this station belong to?</h2>
            <div className="choice-grid" role="radiogroup" aria-label="Project">
              {projects.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={projectId === p.id} className={`choice ${projectId === p.id ? 'on' : ''}`} onClick={() => setProjectId(p.id)}>
                  <b>{p.name}</b><span className="muted">{p.region} region</span>
                </button>
              ))}
              <button type="button" role="radio" aria-checked={projectId === ''} className={`choice ${projectId === '' ? 'on' : ''}`} onClick={() => setProjectId('')}>
                <b>No project yet</b><span className="muted">Link it to a project later</span>
              </button>
            </div>
            {projects.length === 0 && <p className="muted">No projects yet. <Link to="/projects/new">Create a project</Link> first, or continue without one.</p>}
          </section>
        ) : (
          <section className="card">
            <h2>Which region is the station in?</h2>
            {chosen && <p className="muted">Project: <b>{chosen.name}</b></p>}
            <div className="choice-grid regions" role="radiogroup" aria-label="Region">
              {REGIONS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={stationRegion === r} className={`choice ${stationRegion === r ? 'on' : ''}`} onClick={() => setStationRegion(r)}>
                  <b>{r}</b><span className="muted">{REGION_NAMES[r]} Region</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="wizard-bar">
          {stage === 'region' && !search.get('project') && <button type="button" className="btn" onClick={() => setStage('project')}>← Back</button>}
          <span className="grow" />
          <button type="button" className="btn btn-primary" onClick={() => setStage(stage === 'project' ? 'region' : 'form')}>{stage === 'project' ? 'Continue' : 'Start entering details'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page wizard">
      <Breadcrumbs items={projectId
        ? [{ label: region }, { label: 'Projects', to: '/projects' }, { label: projects.find((p) => p.id === projectId)?.name || 'Project', to: `/projects/${projectId}` }, { label: 'Add Station' }]
        : [{ label: region }, { label: 'Stations', to: '/stations' }, { label: 'Create New Station' }]} />
      <div className="list-head">
        <div>
          <h1>{draftId ? 'Continue draft' : 'Create New Station'}</h1>
          <p className="sheet-title">Step {step + 1} of {STEPS.length} · {overall}% of fields filled{record ? ' · draft saved' : ''}</p>
        </div>
        <div className="list-actions"><Link to={lastListPath()} className="btn">Cancel</Link></div>
      </div>

      <div className="wiz-layout">
      <ol className="side-steps" aria-label="Steps">
        {STEPS.map((s, i) => {
          const fs = [...s.fields, ...(s.compare || []).flatMap((c) => c.fields)].filter((f) => f.type !== 'auto' && !f.hidden && isVisible(f, view));
          const filled = fs.filter((f) => !isEmpty(view[f.key])).length;
          return (
            <li key={s.id} className={`${i === step ? 'on' : ''} ${visited.has(i) && i < step ? 'done' : ''}`}>
              <button type="button" onClick={() => goto(i)}>
                <span className="step-n">{i + 1}</span>
                <span className="step-txt"><span className="step-t">{s.title}</span>
                  {fs.length > 0 && <span className="step-c">{filled}/{fs.length}</span>}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="wiz-main">

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {note && <div className="banner banner-ok" role="status">{note}</div>}

      <section className="card step-card">
        <h2>{cur.title}</h2>
        {cur.id === 'scope' && pkg && scopeEmpty && (
          <div className="form-quick-banner">
            <button type="button" className="btn btn-sm btn-accent" onClick={() => Object.entries(pkg.values).forEach(([k, v]) => onChange(k, v))}>
              Fill the standard package
            </button>
            <span className="muted">
              {pkg.values.scope_total} cameras ({pkg.values.scope_fixed ?? 0} fixed, {pkg.values.scope_ptz ?? 0} PTZ) · {pkg.values.scope_panic ?? 0} panic buttons · {pkg.values.scope_va ?? 0} VA
              {' '}— used by {pkg.count} of {pkg.of} stations. Change anything that differs.
            </span>
          </div>
        )}
        {cur.id === 'done' && (
          <div className="form-quick-banner">
            <button type="button" className="btn btn-sm btn-accent" onClick={() => {
              for (const k of ['dome', 'fixed', 'ptz', 'k4', 'yard', 'panic', 'va', 'frs', 'stqc', 'oem']) if (!isEmpty(view[`scope_${k}`])) onChange(`done_${k}`, view[`scope_${k}`]);
            }}>Copy camera quantities from the approved scope</button>
          </div>
        )}
        {cur.id === 'review' ? (
          <Review view={view} errors={strict.errors} warnings={strict.warnings} goto={goto} />
        ) : (
          <>
            {cur.id === 'phase1' && (
              <p className="muted">Fill this in only if the station has existing Non-STQC (Phase-1) cameras. If it has none, leave everything blank.</p>
            )}
            <Fields fields={cur.id === 'master' ? cur.fields.map(withSuggestions) : cur.fields} data={view} onChange={onChange} errors={stepErrors} warnings={stepWarnings} />
            {(cur.compare || []).map((sec) => (
              <details key={sec.id} className="fold" open={cur.compare.length === 1 || sec.id === 'indoor'}>
                <summary><b>{sec.title}</b>{sec.subtitle && <span className="muted"> {sec.subtitle}</span>}</summary>
                <CompareSection section={sec} data={view} onChange={onChange} errors={stepErrors} warnings={stepWarnings} />
              </details>
            ))}
          </>
        )}
      </section>

      <div className="wizard-bar">
        <button type="button" className="btn" disabled={step === 0 || busy} onClick={() => goto(step - 1)}>← Back</button>
        <span className="grow" />
        {cur.id !== 'review' && <button type="button" className="btn" disabled={busy} onClick={saveDraft}>Save Draft</button>}
        {cur.id === 'review'
          ? <button type="button" className="btn btn-primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create Station'}</button>
          : <button type="button" className="btn btn-primary" disabled={busy} onClick={next}>{busy ? 'Saving…' : (step === STEPS.length - 2 ? 'Save & Review' : 'Save & Continue')}</button>}
      </div>
      </div>
      </div>
    </div>
  );
}

import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import { PROJECT_STATUSES, PROJECT_TYPES } from './Projects.jsx';

const EMPTY = {
  name: '', code: '', description: '', type: '', executing_agency: '', scope_description: '', approved_station_count: '',
  approved_camera_scope: '', start_date: '', target_completion_date: '', status: 'Active', remarks: '',
};
const STEPS = [
  { id: 'identity', title: 'Project Identity', keys: ['name', 'code', 'description'] },
  { id: 'class', title: 'Project Classification', keys: ['type'] },
  { id: 'agency', title: 'Executing Agency & Scope', keys: ['executing_agency', 'scope_description', 'approved_station_count', 'approved_camera_scope'] },
  { id: 'dates', title: 'Targets & Dates', keys: ['start_date', 'target_completion_date', 'status', 'remarks'] },
  { id: 'review', title: 'Review', keys: [] },
];
const LABEL = {
  name: 'Project name', code: 'Project code / reference', description: 'Description', type: 'Project type',
  executing_agency: 'Executing agency', scope_description: 'Scope description', approved_station_count: 'Approved station count',
  approved_camera_scope: 'Approved camera scope (total cameras)', start_date: 'Project start date',
  target_completion_date: 'Target completion date', status: 'Current status', remarks: 'Remarks',
};

function validate(d) {
  const e = {};
  if (!d.name.trim()) e.name = 'Required';
  if (!d.type) e.type = 'Choose a project type';
  for (const k of ['approved_station_count', 'approved_camera_scope']) {
    if (d[k] !== '' && !/^\d+$/.test(String(d[k]))) e[k] = 'Must be a whole number, 0 or more';
  }
  if (d.start_date && d.target_completion_date && d.target_completion_date < d.start_date) e.target_completion_date = 'Cannot be before the start date';
  return e;
}

function Input({ k, d, set, err }) {
  const id = `p-${k}`;
  const common = { id, value: d[k] ?? '', onChange: (e) => set(k, e.target.value), 'aria-invalid': err ? true : undefined };
  let el;
  if (k === 'type') el = <select {...common}><option value="">Select…</option>{PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>;
  else if (k === 'status') el = <select {...common}>{PROJECT_STATUSES.map((t) => <option key={t}>{t}</option>)}</select>;
  else if (['description', 'scope_description', 'remarks'].includes(k)) el = <textarea rows={3} {...common} />;
  else if (k.endsWith('_date')) el = <input type="date" {...common} />;
  else if (k.startsWith('approved')) el = <input type="number" min="0" step="1" {...common} />;
  else el = <input type="text" {...common} />;
  return (
    <div className={`field ${['description', 'scope_description', 'remarks'].includes(k) ? 'full' : ''} ${err ? 'has-error' : ''}`}>
      <label htmlFor={id} className="field-label"><span>{LABEL[k]}{k === 'name' || k === 'type' ? <b className="req"> *</b> : null}</span></label>
      {el}
      {err && <div className="msg msg-error" role="alert">{err}</div>}
    </div>
  );
}

export default function ProjectForm() {
  const { id } = useParams(); // present when editing
  const editing = !!id;
  const navigate = useNavigate();
  const { user, region } = useContext(UserContext);
  const [d, setD] = useState(EMPTY);
  const [rec, setRec] = useState(null);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.project(id).then((p) => {
      setRec(p);
      setD(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? ''])));
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [id, editing]);

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const errors = validate(d);
  const shown = tried ? errors : {};

  const save = async () => {
    setTried(true);
    if (Object.keys(errors).length) {
      setError('Fix the highlighted fields.');
      const first = STEPS.findIndex((s) => s.keys.some((k) => errors[k]));
      if (!editing && first >= 0) setStep(first);
      return;
    }
    setBusy(true); setError('');
    try {
      const out = editing ? await api.updateProject(id, d, user, rec.updated_at) : await api.createProject(d, user);
      navigate(`/projects/${out.id}`, { replace: true });
    } catch (e) {
      if (e.status === 409 && e.body?.code === 'duplicate') setError('A project with this name or code already exists.');
      else if (e.status === 409) setError('This project was changed by someone else. Reload the page to get the latest.');
      else if (e.status === 422) setError(`The server rejected: ${Object.keys(e.body.errors || {}).map((k) => LABEL[k] || k).join(', ')}.`);
      else setError(e.message);
    } finally { setBusy(false); }
  };

  const next = () => {
    setTried(true);
    const mine = STEPS[step].keys.filter((k) => errors[k]);
    if (mine.length) { setError('Fix the highlighted fields to continue.'); return; }
    setError(''); setTried(false); setStep(step + 1); window.scrollTo({ top: 0 });
  };

  if (loading) return <div className="page"><p className="muted">Loading…</p></div>;
  const crumbs = editing
    ? [{ label: region }, { label: 'Projects', to: '/projects' }, { label: rec?.name || 'Project', to: `/projects/${id}` }, { label: 'Edit' }]
    : [{ label: region }, { label: 'Projects', to: '/projects' }, { label: 'Create New Project' }];

  return (
    <div className="page wizard">
      <Breadcrumbs items={crumbs} />
      <div className="list-head">
        <div><h1>{editing ? 'Edit Project' : 'Create New Project'}</h1>{!editing && <p className="sheet-title">Step {step + 1} of {STEPS.length} · then add or link stations</p>}</div>
        <div className="list-actions"><Link to={editing ? `/projects/${id}` : '/projects'} className="btn">Cancel</Link></div>
      </div>

      <div className={editing ? '' : 'wiz-layout'}>
      {!editing && (
        <ol className="side-steps" aria-label="Steps">
          {STEPS.map((s, i) => {
            const filled = s.keys.filter((k) => String(d[k] ?? '') !== '').length;
            return (
              <li key={s.id} className={`${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                <button type="button" onClick={() => { setStep(i); setError(''); }}>
                  <span className="step-n">{i + 1}</span>
                  <span className="step-txt"><span className="step-t">{s.title}</span>{s.keys.length > 0 && <span className="step-c">{filled}/{s.keys.length}</span>}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="wiz-main">
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      {(editing ? STEPS.filter((s) => s.id !== 'review') : [STEPS[step]]).map((s) => (
        <section className="card step-card" key={s.id}>
          <h2>{s.title}</h2>
          {s.id === 'review' ? (
            <dl className="kv">
              {Object.keys(LABEL).map((k) => <div key={k}><dt>{LABEL[k]}</dt><dd>{d[k] === '' ? <span className="not-set">Not set</span> : String(d[k])}</dd></div>)}
            </dl>
          ) : <div className="grid g2">{s.keys.map((k) => <Input key={k} k={k} d={d} set={set} err={shown[k]} />)}</div>}
        </section>
      ))}

      <div className="wizard-bar">
        {!editing && <button type="button" className="btn" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>← Back</button>}
        <span className="grow" />
        {editing || step === STEPS.length - 1
          ? <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create Project'}</button>
          : <button type="button" className="btn btn-primary" onClick={next}>Continue</button>}
      </div>
      </div>
      </div>
    </div>
  );
}

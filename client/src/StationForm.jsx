import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  SECTIONS, FIELDS, applyComputed, defaultsFor, isVisible, validate, sectionProgress, overallProgress,
  sameValue, isEmpty,
} from '@shared/fields.js';
import { lookupStation } from '@shared/stationsMaster.js';
import { api } from './api.js';
import { UserContext } from './App.jsx';
import Field, { fieldId } from './Field.jsx';
import CompareSection from './CompareSection.jsx';
import StatusPill from './StatusPill.jsx';
import HistoryModal from './HistoryModal.jsx';
import { fmtDate, lastListPath } from './format.js';

const EDITABLE = FIELDS.filter((f) => f.type !== 'auto');
const targetField = FIELDS.find((f) => f.key === 'target_commission_date');

/** Card value: the text, or a muted "Not set" when empty. */
function Value({ v, format = String }) {
  return isEmpty(v) ? <span className="not-set">Not set</span> : format(v);
}

function SectionBody({ section, view, onChange, errors, warnings, isNew }) {
  if (section.kind === 'compare') {
    return <CompareSection section={section} data={view} onChange={onChange} errors={errors} warnings={warnings} />;
  }

  const copyScopeCameras = () => {
    const keys = ['dome', 'fixed', 'ptz', 'k4', 'yard', 'panic', 'va', 'frs', 'stqc', 'oem'];
    for (const k of keys) {
      if (!isEmpty(view[`scope_${k}`])) {
        onChange(`done_${k}`, view[`scope_${k}`]);
      }
    }
  };

  const masterMatch = isNew && section.id === 'station' && view.stn_code ? lookupStation(view.stn_code) : null;
  const applyMaster = (m) => {
    if (!m) return;
    onChange('station_name', m.name);
    onChange('zone', m.zone);
    onChange('division', m.division);
    onChange('state', m.state);
    onChange('server_thana', m.thana);
    onChange('server_thana_code', m.thanaCode);
    if (m.cat) onChange('old_category', m.cat);
  };

  const items = [];
  if (section.id === 'done') {
    items.push(
      <div key="copy-cams" className="form-quick-banner full">
        <button type="button" className="btn btn-sm btn-accent" onClick={copyScopeCameras}>
          ⚡ Copy All Camera Quantities from Scope (Section 2)
        </button>
      </div>
    );
  }

  if (masterMatch) {
    items.push(
      <div key="master-lookup" className="form-lookup-banner full">
        <span>⚡ Found in Railway Station Directory: <b>{masterMatch.name}</b> ({masterMatch.zone} · {masterMatch.division} · {masterMatch.state})</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => applyMaster(masterMatch)}>
          Auto-fill Station Details
        </button>
      </div>
    );
  }

  let lastGroup = null;
  for (const f of section.fields) {
    if (!isVisible(f, view)) continue;
    if (f.group && f.group !== lastGroup) items.push(<h4 key={`g-${f.group}`} className="subhead">{f.group}</h4>);
    lastGroup = f.group || lastGroup;
    items.push(<Field key={f.key} def={f} data={view} onChange={onChange} error={errors[f.key]} warning={warnings[f.key]} />);
  }
  return <div className="grid">{items}</div>;
}

export default function StationForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const targetSection = searchParams.get('section');
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user, focusUser } = useContext(UserContext);

  const [record, setRecord] = useState(null);
  const [original, setOriginal] = useState(isNew ? defaultsFor() : null);
  const [data, setData] = useState(isNew ? defaultsFor() : null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [open, setOpen] = useState(() => new Set([targetSection || 'station']));

  useEffect(() => {
    if (targetSection) {
      setOpen((o) => new Set(o).add(targetSection));
      setTimeout(() => document.getElementById(`sec-${targetSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [targetSection]);
  const [toast, setToast] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [stationsList, setStationsList] = useState([]);

  useEffect(() => {
    api.all().then((all) => setStationsList(all.sort((a, b) => a.sn - b.sn))).catch(() => {});
  }, []);

  // ---- load
  useEffect(() => {
    setAttempted(false);
    setConflict(null);
    if (isNew) {
      setRecord(null); setOriginal(defaultsFor()); setData(defaultsFor()); setLoadError('');
      return undefined;
    }
    let live = true;
    setData(null);
    api.get(id)
      .then((r) => { if (live) { setRecord(r); setOriginal(r.data); setData(r.data); setLoadError(''); } })
      .catch((e) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, [id, isNew]);

  // ---- derived state
  const view = useMemo(() => (data ? applyComputed(data) : null), [data]);
  const { errors, warnings } = useMemo(() => (view ? validate(view) : { errors: {}, warnings: {} }), [view]);
  const showErrors = attempted || !isNew;
  const shownErrors = showErrors ? errors : {};

  const currentIndex = useMemo(() => {
    if (isNew || !record) return -1;
    return stationsList.findIndex((s) => s.id === record.id);
  }, [stationsList, isNew, record]);

  const prevStation = currentIndex > 0 ? stationsList[currentIndex - 1] : null;
  const nextStation = currentIndex >= 0 && currentIndex < stationsList.length - 1 ? stationsList[currentIndex + 1] : null;

  const changedKeys = useMemo(() => {
    if (!view || !original) return [];
    const base = applyComputed(original);
    return EDITABLE.filter((f) => !sameValue(view[f.key], base[f.key])).map((f) => f.key);
  }, [view, original]);
  const dirty = changedKeys.length > 0;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const progress = useMemo(() => (view ? SECTIONS.map((s) => sectionProgress(s, view)) : []), [view]);
  const overall = useMemo(() => (view ? overallProgress(view) : { pct: 0 }), [view]);

  // Keep --card-h equal to the pinned card's real height, so the navigator and scroll offsets
  // clear it at every screen width.
  const cardRef = useRef(null);
  const ready = !!view;
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const set = () => document.documentElement.style.setProperty('--card-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--card-h'); };
  }, [ready]);

  // ---- leaving with unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    const warn = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // ---- toast
  const timer = useRef(null);
  const notify = useCallback((kind, text) => {
    setToast({ kind, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // ---- editing
  const onChange = useCallback((key, value) => setData((d) => ({ ...d, [key]: value })), []);

  const openSection = (sectionId, scroll = true) => {
    setOpen((o) => new Set(o).add(sectionId));
    if (scroll) setTimeout(() => document.getElementById(`sec-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const toggle = (sectionId) => setOpen((o) => {
    const n = new Set(o);
    if (n.has(sectionId)) n.delete(sectionId); else n.add(sectionId);
    return n;
  });

  // ---- save
  const save = useCallback(async () => {
    if (!view || saving || (!dirty && !isNew)) return;
    setAttempted(true);
    const bad = Object.keys(errors);
    if (bad.length) {
      const first = SECTIONS.find((s) => s.fields.some((f) => bad.includes(f.key)));
      const firstKey = first.fields.find((f) => bad.includes(f.key)).key;
      openSection(first.id, false);
      setTimeout(() => {
        const el = document.getElementById(fieldId(firstKey));
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus?.();
      }, 60);
      notify('error', `Cannot save: ${bad.length} error${bad.length > 1 ? 's' : ''} to fix.`);
      return;
    }
    setSaving(true);
    try {
      let res;
      if (isNew) {
        const payload = Object.fromEntries(EDITABLE.filter((f) => !isEmpty(view[f.key])).map((f) => [f.key, view[f.key]]));
        res = await api.create(payload, user.trim());
      } else {
        const payload = Object.fromEntries(changedKeys.map((k) => [k, view[k] ?? null]));
        res = await api.update(record.id, payload, user.trim(), record.updated_at);
      }
      const warnCount = Object.keys(res.warnings || {}).length;
      dirtyRef.current = false;
      setRecord(res); setOriginal(res.data); setData(res.data); setConflict(null);
      notify('success', `Saved${warnCount ? ` with ${warnCount} warning${warnCount > 1 ? 's' : ''}` : ''}.`);
      if (isNew) navigate(`/stations/${res.id}`, { replace: true });
    } catch (e) {
      if (e.status === 409 && e.body?.current) setConflict(e.body);
      else if (e.status === 422) notify('error', 'The server rejected the data. Please fix the highlighted fields.');
      else notify('error', e.message);
    } finally {
      setSaving(false);
    }
  }, [view, saving, dirty, isNew, user, errors, changedKeys, record, notify, focusUser, navigate]);

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const discard = () => setData(original);

  const loadLatestKeepingEdits = () => {
    const mine = Object.fromEntries(changedKeys.map((k) => [k, view[k] ?? null]));
    const cur = conflict.current;
    setRecord(cur); setOriginal(cur.data); setData({ ...cur.data, ...mine }); setConflict(null);
    notify('success', 'Loaded the latest version with your edits on top. Review and save again.');
  };

  if (loadError) return <div className="page"><div className="banner banner-error" role="alert">{loadError}</div></div>;
  if (!view) return <div className="page"><p className="muted">Loading…</p></div>;

  const cams = `${view.done_total ?? 0} / ${view.scope_total ?? 0}`;
  const meta = [view.zone, view.division, view.state, view.server_thana].filter(Boolean).join(' · ');

  return (
    <div className="form-page">
      <header className="station-card" ref={cardRef}>
        <div className="sc-main">
          <span className="code-badge big">{view.stn_code || 'NEW'}</span>
          <div className="sc-title">
            <div className="sc-title-row">
              <h1>{view.station_name || (isNew ? 'New station' : 'Unnamed station')}</h1>
              {!isNew && stationsList.length > 1 && (
                <div className="stn-stepper">
                  <button type="button" className="btn btn-sm" disabled={!prevStation} onClick={() => navigate(`/stations/${prevStation.id}`)} title={prevStation ? `Previous: #${prevStation.sn} ${prevStation.stn_code} (${prevStation.station_name})` : 'No previous station'}>
                    ◄ Prev
                  </button>
                  <select className="stn-quick-select" value={record?.id || ''} onChange={(e) => { if (e.target.value) navigate(`/stations/${e.target.value}`); }} aria-label="Jump to station">
                    {stationsList.map((s) => (
                      <option key={s.id} value={s.id}>#{s.sn} {s.stn_code} – {s.station_name} ({s.zone}/{s.division})</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-sm" disabled={!nextStation} onClick={() => navigate(`/stations/${nextStation.id}`)} title={nextStation ? `Next: #${nextStation.sn} ${nextStation.stn_code} (${nextStation.station_name})` : 'No next station'}>
                    Next ►
                  </button>
                </div>
              )}
            </div>
            <div className="sc-meta">{meta || 'Fill in station details'}</div>
          </div>
        </div>
        <dl className="sc-facts">
          <div><dt>Category</dt><dd><Value v={view.new_category} /></dd></div>
          <div><dt>Status</dt><dd><StatusPill status={view.status} /></dd></div>
          {targetField && isVisible(targetField, view) && (
            <div><dt>Target date</dt><dd><Value v={view.target_commission_date} format={fmtDate} /></dd></div>
          )}
          <div><dt>Cameras done / scope</dt><dd>{cams}</dd></div>
          <div><dt>Filled</dt><dd>{overall.pct}%</dd></div>
        </dl>
        <div className="sc-actions">
          <button type="button" className="btn" onClick={() => navigate(lastListPath())}>← Back to list</button>
          <button type="button" className="btn" disabled={isNew} onClick={() => navigate(`/stations/${record.id}/view`)}>View record</button>
          <button type="button" className="btn" disabled={isNew} onClick={() => setShowHistory(true)}>History</button>
          <button type="button" className="btn" onClick={() => setOpen(new Set(SECTIONS.map((s) => s.id)))}>Expand all</button>
          <button type="button" className="btn" onClick={() => setOpen(new Set())}>Collapse all</button>
        </div>
      </header>

      {conflict && (
        <div className="banner banner-error conflict" role="alert">
          <span>{conflict.error || 'Someone else saved this station first.'}</span>
          <button type="button" className="btn" onClick={loadLatestKeepingEdits}>Load latest, keep my edits</button>
        </div>
      )}

      <div className="form-layout">
        <nav className="section-nav" aria-label="Form sections">
          {SECTIONS.map((s, i) => {
            const p = progress[i];
            const done = !p.na && p.total > 0 && p.filled === p.total;
            return (
              <button type="button" key={s.id} className={`nav-item ${p.na ? 'is-na' : ''}`} onClick={() => openSection(s.id)}>
                <span className={`num ${done ? 'done' : ''}`}>{done ? '✓' : s.number}</span>
                <span className="nav-text">
                  <span className="nav-title">{s.title}</span>
                  <span className="nav-prog">{p.na ? 'N/A' : `${p.filled}/${p.total}`}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sections">
          {SECTIONS.map((s, i) => {
            const p = progress[i];
            const isOpen = open.has(s.id);
            const errCount = s.fields.filter((f) => shownErrors[f.key] && isVisible(f, view)).length;
            const warnCount = s.fields.filter((f) => warnings[f.key] && isVisible(f, view)).length;
            const complete = !p.na && p.total > 0 && p.filled === p.total && errCount === 0;
            const pct = p.total ? Math.round((p.filled / p.total) * 100) : 0;
            return (
              <section key={s.id} id={`sec-${s.id}`} className="accordion">
                <h2>
                  <button type="button" className="acc-head" aria-expanded={isOpen} aria-controls={`panel-${s.id}`}
                    id={`head-${s.id}`} onClick={() => toggle(s.id)}>
                    <span className={`num ${complete ? 'done' : ''}`}>{complete ? '✓' : s.number}</span>
                    <span className="acc-titles">
                      <span className="acc-title">{s.title}</span>
                      <span className="acc-sub">{s.subtitle}</span>
                    </span>
                    <span className="acc-meta">
                      <span className="col-tag">{s.cols}</span>
                      {errCount > 0 && <span className="badge badge-err">{errCount} error{errCount > 1 ? 's' : ''}</span>}
                      {warnCount > 0 && <span className="badge badge-warn">{warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
                      {p.na
                        ? <span className="acc-count na-label">N/A</span>
                        : (
                          <>
                            <span className="acc-count">{p.filled} / {p.total}</span>
                            <span className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                          </>
                        )}
                      <span className={`chev ${isOpen ? 'open' : ''}`} aria-hidden="true">▾</span>
                    </span>
                  </button>
                </h2>
                <div id={`panel-${s.id}`} role="region" aria-labelledby={`head-${s.id}`} hidden={!isOpen} className="acc-body">
                  {isOpen && <SectionBody section={s} view={view} onChange={onChange} errors={shownErrors} warnings={warnings} isNew={isNew} />}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {(dirty || saving) && (
        <div className="save-bar" role="region" aria-label="Unsaved changes">
          <span className="save-count">{changedKeys.length} unsaved change{changedKeys.length === 1 ? '' : 's'}</span>
          <div className="save-actions">
            <button type="button" className="btn" onClick={discard} disabled={saving}>Discard</button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.text}</div>}
      {showHistory && <HistoryModal stationId={record.id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

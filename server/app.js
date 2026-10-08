import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import {
  pickKnown, applyComputed, validate, overallProgress, sameValue, deriveLifecycle, LIFECYCLE, FIELDS, REGIONS, DEFAULT_REGION,
} from '../shared/fields.js';
import {
  Station, StationHistory, Counter, Project, ProjectStation, ProjectHistory, PROJECT_STATUSES,
} from './models/index.js';

// ---------------------------------------------------------------- helpers
const clean = (data) => {
  const picked = pickKnown(data);
  for (const [k, v] of Object.entries(picked)) if (typeof v === 'string') picked[k] = v.trim() === '' ? null : v.trim();
  return picked;
};

/** A stored station as the API (and the browser) sees it: string id, ISO dates. */
const toApi = (d) => ({
  id: String(d._id), sn: d.sn, stn_code: d.stn_code, station_name: d.station_name, zone: d.zone,
  division: d.division ?? null, status: d.status ?? null, data: d.data,
  created_at: d.created_at.toISOString(), updated_at: d.updated_at.toISOString(), updated_by: d.updated_by ?? null,
  created_by: d.created_by ?? null, lifecycle: d.lifecycle ?? null, draft: !!d.draft, origin: d.origin ?? 'application',
  region: d.region ?? DEFAULT_REGION,
});

const toSummary = (d) => {
  const x = d.data || {};
  return {
    id: String(d._id), sn: d.sn, stn_code: d.stn_code, station_name: d.station_name, zone: d.zone,
    division: d.division ?? null, status: d.status ?? null, updated_at: d.updated_at.toISOString(),
    new_beyond_scope: x.new_beyond_scope ?? null, server_thana: x.server_thana ?? null,
    server_thana_code: x.server_thana_code ?? null, monitoring_thana: x.monitoring_thana ?? null,
    monitoring_thana_code: x.monitoring_thana_code ?? null, state: x.state ?? null, phase1: x.phase1 ?? null,
    old_category: x.old_category ?? null, new_category: x.new_category ?? null,
    scope_total: x.scope_total ?? 0, done_total: x.done_total ?? 0, handed_over: x.handed_over ?? null,
    target_commission_date: x.target_commission_date ?? null, progress: overallProgress(x).pct,
    hindrance_type: x.hindrance_type ?? null, handover_date: x.handover_date ?? null, handover_target: x.handover_target ?? null,
    install_month: x.install_month ?? null, install_year: x.install_year ?? null, has_phase1: x.has_phase1 ?? null,
    out_status: x.sc_out_status ?? null, room: x.sc_room ?? null, power: x.sc_power ?? null, ac: x.sc_ac ?? null, dg: x.sc_dg ?? null,
    room2: x.ac_room ?? null, power2: x.ac_power ?? null, out_status2: x.ac_out_status ?? null,
    lifecycle: d.lifecycle ?? null, draft: !!d.draft, origin: d.origin ?? 'application', region: d.region ?? DEFAULT_REGION,
    created_by: d.created_by ?? null, updated_by: d.updated_by ?? null,
  };
};

// ---- projects
const PROJECT_FIELDS = ['code', 'name', 'description', 'executing_agency', 'scope_description', 'status',
  'start_date', 'target_completion_date', 'approved_station_count', 'approved_camera_scope', 'remarks'];
const IN_PROGRESS = ['New', 'Survey Pending', 'Survey Completed', 'Work In Progress', 'Offered'];
const isoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

const projectToApi = (p, stats) => ({
  id: String(p._id), region: p.region, code: p.code ?? null, name: p.name, description: p.description ?? null,
  executing_agency: p.executing_agency ?? null, scope_description: p.scope_description ?? null, status: p.status,
  start_date: p.start_date ?? null, target_completion_date: p.target_completion_date ?? null,
  approved_station_count: p.approved_station_count ?? null, approved_camera_scope: p.approved_camera_scope ?? null,
  remarks: p.remarks ?? null, source_values: p.source_values || [],
  created_at: p.created_at.toISOString(), updated_at: p.updated_at.toISOString(), created_by: p.created_by, updated_by: p.updated_by,
  stats,
});

/** Stats are computed inside MongoDB ($group), so only a few numbers cross the network, not every station. */
const NUM = (path) => ({ $convert: { input: path, to: 'double', onError: 0, onNull: 0 } });
const flag = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const statGroup = (idExpr) => ({
  _id: idExpr,
  total: { $sum: 1 },
  commissioned: flag({ $and: [{ $ne: ['$lifecycle', 'Closed'] }, { $in: ['$status', DONE] }] }),
  in_progress: flag({ $in: ['$lifecycle', IN_PROGRESS] }),
  hindrance: flag({ $eq: ['$lifecycle', 'On Hold / Hindrance'] }),
  handover_pending: flag({ $eq: ['$lifecycle', 'Handover Pending'] }),
  dropped: flag({ $eq: ['$lifecycle', 'Closed'] }),
  drafts: flag({ $eq: ['$draft', true] }),
  scope_cameras: { $sum: NUM('$data.scope_total') },
  done_cameras: { $sum: NUM('$data.done_total') },
});
function finishStats(r = {}) {
  const s = {
    total: 0, commissioned: 0, in_progress: 0, hindrance: 0, handover_pending: 0, dropped: 0, drafts: 0, scope_cameras: 0, done_cameras: 0, ...r,
  };
  delete s._id;
  s.balance = s.total - s.commissioned - s.dropped;
  const live = s.total - s.dropped;
  s.progress = live ? Math.round((s.commissioned / live) * 100) : 0;
  return s;
}
const STAT_FIELDS = { lifecycle: 1, status: 1, draft: 1, 'data.scope_total': 1, 'data.done_total': 1 };

async function statsByProject(projectIds) {
  const rows = await ProjectStation.aggregate([
    { $match: { project: { $in: projectIds } } },
    { $lookup: { from: 'stations', localField: 'station', foreignField: '_id', pipeline: [{ $project: STAT_FIELDS }], as: 's' } },
    { $unwind: '$s' },
    { $replaceRoot: { newRoot: { $mergeObjects: [{ project: '$project' }, '$s'] } } },
    { $group: statGroup('$project') },
  ]);
  const out = Object.fromEntries(projectIds.map((id) => [String(id), finishStats()]));
  for (const r of rows) out[String(r._id)] = finishStats(r);
  return out;
}

/** Limit a station filter to the stations linked to a project (?project=<id>, or "none" for unlinked stations). */
async function restrictToProject(filter, projectId) {
  if (projectId === 'none') {
    const linked = await ProjectStation.distinct('station');
    filter._id = { $nin: linked };
    return;
  }
  if (!mongoose.isValidObjectId(projectId)) { filter._id = { $in: [] }; return; }
  filter._id = { $in: await ProjectStation.distinct('station', { project: projectId }) };
}

function cleanProject(body = {}) {
  const out = {};
  for (const k of PROJECT_FIELDS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (typeof v === 'string') v = v.trim() === '' ? null : v.trim();
    if (['approved_station_count', 'approved_camera_scope'].includes(k) && v !== null) v = Number(v);
    out[k] = v;
  }
  return out;
}
function validateProject(p, { partial = false } = {}) {
  const errors = {};
  if (!partial || 'name' in p) { if (!p.name) errors.name = 'Required'; }
  if (p.status && !PROJECT_STATUSES.includes(p.status)) errors.status = 'Choose a status';
  for (const k of ['start_date', 'target_completion_date']) if (p[k] && !isoDate(p[k])) errors[k] = 'Enter a valid date';
  for (const k of ['approved_station_count', 'approved_camera_scope']) if (p[k] !== null && p[k] !== undefined && (!Number.isInteger(p[k]) || p[k] < 0)) errors[k] = 'Must be a whole number, 0 or more';
  if (p.start_date && p.target_completion_date && isoDate(p.start_date) && isoDate(p.target_completion_date) && p.target_completion_date < p.start_date) errors.target_completion_date = 'Cannot be before the start date';
  return errors;
}

// --- list views (one place defines what "Commissioned", "In progress" ... mean) ---
const DONE = ['Completed', 'Go Live'];
const VIEWS = {
  commissioned: () => ({ status: { $in: DONE } }),
  in_progress: () => ({ lifecycle: { $in: ['New', 'Survey Pending', 'Survey Completed', 'Work In Progress', 'Offered'] } }),
  hindrance: () => ({ lifecycle: 'On Hold / Hindrance' }),
  handover_pending: () => ({ lifecycle: 'Handover Pending' }),
  drafts: () => ({ draft: true }),
  closed: () => ({ lifecycle: 'Closed' }),
};
function filterFrom({ region, zone, division, status, q, view, lifecycle, state }) {
  const filter = view && VIEWS[view] ? VIEWS[view]() : {};
  if (region) filter.region = String(region);
  if (zone) filter.zone = String(zone);
  if (division) filter.division = String(division);
  if (status) filter.status = String(status);
  if (lifecycle) filter.lifecycle = String(lifecycle);
  if (state) filter['data.state'] = String(state);
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i');
    filter.$or = [{ stn_code: rx }, { station_name: rx }, { 'data.server_thana': rx }];
  }
  return filter;
}
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const SORTS = {
  sn: 'sn', stn_code: 'stn_code', station_name: 'station_name', division: 'division', status: 'status',
  zone: 'zone', lifecycle: 'lifecycle', updated_at: 'updated_at',
  state: 'data.state', scope_total: 'data.scope_total', done_total: 'data.done_total',
  target: 'data.target_commission_date', old_category: 'data.old_category', new_category: 'data.new_category',
};

const diff = (before, after) => {
  const changes = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!sameValue(before[k], after[k])) changes[k] = { from: before[k] ?? null, to: after[k] ?? null };
  }
  return changes;
};

class HttpError extends Error {
  constructor(status, body) {
    super(body.error || 'error');
    this.status = status;
    this.body = body;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDuplicateKey = (e) => e?.code === 11000;

// No login yet: the name is optional and defaults to "Operator".
const userName = (u) => (typeof u === 'string' && u.trim() ? u.trim() : 'Operator');

const parseId = (req) => {
  const raw = String(req.params.id);
  if (!/^[0-9a-f]{24}$/i.test(raw) || !mongoose.isValidObjectId(raw)) throw new HttpError(404, { error: 'Station not found' });
  return new mongoose.Types.ObjectId(raw);
};

/** Next S.N.: an atomic counter, started from the highest existing S.N. so it never repeats. */
async function nextSn() {
  if (!(await Counter.exists({ _id: 'stations' }))) {
    const top = await Station.findOne({}, { sn: 1 }).sort({ sn: -1 }).lean();
    try { await Counter.create({ _id: 'stations', seq: top?.sn || 0 }); } catch { /* another request created it first */ }
  }
  const c = await Counter.findOneAndUpdate({ _id: 'stations' }, { $inc: { seq: 1 } }, { returnDocument: 'after' }).lean();
  return c.seq;
}

// -------------------------------------------------------------------- app
export function createApp() {
  const app = express();
  const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.includes('*') ? true : origins }));
  app.use(express.json({ limit: '1mb' }));

  // The API has no web page. If someone opens its address in a browser, point them to the right place.
  app.get('/', (req, res) => {
    res.type('html').send(
      '<!doctype html><meta charset="utf-8"><title>CCTV Station API</title>'
      + '<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;line-height:1.5">'
      + '<h2>CCTV Station API is running</h2>'
      + '<p>This is the backend, so it has no web page. Open the website at '
      + '<a href="http://localhost:5173">http://localhost:5173</a> (started with <code>npm run dev</code>).</p>'
      + '<p>Check the database connection: <a href="/api/health">/api/health</a></p></body>',
    );
  });

  app.get('/api/health', wrap(async (req, res) => {
    if (mongoose.connection.readyState !== 1) throw new HttpError(503, { error: 'Database is not connected' });
    await mongoose.connection.db.admin().ping();
    res.json({ ok: true, database: mongoose.connection.name });
  }));

  // List. ?full=1 returns complete records (the browser's Stations page and Report use this);
  // otherwise lightweight summaries. Filters: zone, division, status, q (code, name or thana).
  app.get('/api/stations', wrap(async (req, res) => {
    const { full, page, sort, dir } = req.query;
    const filter = filterFrom(req.query);
    if (req.query.project) await restrictToProject(filter, req.query.project);
    const order = { [SORTS[sort] || 'sn']: dir === 'desc' ? -1 : 1, sn: 1 };
    const map = full ? toApi : toSummary;
    if (page === undefined) { // no paging asked for: everything (the Stations and Report pages use this)
      return res.json((await Station.find(filter).sort(order).lean()).map(map));
    }
    const size = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    const total = await Station.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / size));
    const pg = Math.min(pages, Math.max(1, Number(page) || 1));
    const docs = await Station.find(filter).sort(order).skip((pg - 1) * size).limit(size).lean();
    return res.json({ items: docs.map(map), total, page: pg, pageSize: size, pages });
  }));

  // CSV of the current filter: one row per station, one column per form field (header carries the Excel column).
  app.get('/api/export', wrap(async (req, res) => {
    const exportFilter = filterFrom(req.query);
    if (req.query.project) await restrictToProject(exportFilter, req.query.project);
    const docs = await Station.find(exportFilter).sort({ sn: 1 }).lean();
    const cols = FIELDS.filter((f) => !f.hidden || f.srcCol);
    const head = ['S.N.', 'Lifecycle', 'Draft', ...cols.map((f) => `${f.label} [${f.srcCol || f.col}]`)];
    const lines = [head.map(csvCell).join(',')];
    for (const d of docs) {
      lines.push([d.sn, d.lifecycle, d.draft ? 'Yes' : 'No', ...cols.map((f) => d.data?.[f.key])].map(csvCell).join(','));
    }
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="nr-stations.csv"' });
    res.send(`﻿${lines.join('\r\n')}`);
  }));

  // Everything the dashboard shows. One database pass (aggregation); only small summaries are sent back.
  app.get('/api/dashboard', wrap(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const rowFields = { stn_code: 1, station_name: 1, zone: 1, division: 1, status: 1, lifecycle: 1, updated_at: 1, updated_by: 1, 'data.target_commission_date': 1, 'data.hindrance_type': 1 };
    const noHindrance = { $or: [{ $eq: ['$data.hindrance_type', null] }, { $eq: ['$data.hindrance_type', ''] }] };
    const [a] = await Station.aggregate([
      { $match: req.query.region ? { region: String(req.query.region) } : {} },
      { $facet: {
        totals: [{ $group: { _id: null, stations: { $sum: 1 }, commissioned: flag({ $in: ['$status', DONE] }), drafts: flag({ $eq: ['$draft', true] }), scope_cameras: { $sum: NUM('$data.scope_total') }, done_cameras: { $sum: NUM('$data.done_total') } } }],
        life: [{ $group: { _id: '$lifecycle', n: { $sum: 1 } } }],
        status: [{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { n: -1 } }],
        zone: [{ $group: { _id: '$zone', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        division: [{ $group: { _id: '$division', total: { $sum: 1 }, commissioned: flag({ $in: ['$status', DONE] }), scope: { $sum: NUM('$data.scope_total') }, done: { $sum: NUM('$data.done_total') } } }, { $sort: { total: -1 } }],
        hind: [{ $match: { lifecycle: 'On Hold / Hindrance' } }, { $group: { _id: { $cond: [noHindrance, { $ifNull: ['$status', 'Not stated'] }, '$data.hindrance_type'] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }],
        upcoming: [{ $match: { $and: [{ status: { $nin: DONE } }, { 'data.target_commission_date': { $regex: '^\\d{4}-\\d{2}-\\d{2}$' } }, { 'data.target_commission_date': { $gte: today } }] } }, { $sort: { 'data.target_commission_date': 1 } }, { $limit: 10 }, { $project: rowFields }],
        handover: [{ $match: { lifecycle: 'Handover Pending' } }, { $sort: { updated_at: -1 } }, { $limit: 10 }, { $project: rowFields }],
        recent: [{ $sort: { updated_at: -1 } }, { $limit: 10 }, { $project: rowFields }],
      } },
    ]);
    const row = (d) => ({
      id: String(d._id), stn_code: d.stn_code, station_name: d.station_name, zone: d.zone, division: d.division ?? null,
      lifecycle: d.lifecycle ?? null, status: d.status ?? null, target: d.data?.target_commission_date ?? null,
      hindrance_type: d.data?.hindrance_type ?? null, updated_at: d.updated_at.toISOString(), updated_by: d.updated_by ?? null,
    });
    const byLife = Object.fromEntries(a.life.map((x) => [x._id, x.n]));
    const t = a.totals[0] || { stations: 0, commissioned: 0, drafts: 0, scope_cameras: 0, done_cameras: 0 };
    res.json({
      totals: {
        stations: t.stations, commissioned: t.commissioned,
        in_progress: IN_PROGRESS.reduce((s, k) => s + (byLife[k] || 0), 0),
        hindrance: byLife['On Hold / Hindrance'] || 0, handover_pending: byLife['Handover Pending'] || 0,
        drafts: t.drafts, scope_cameras: t.scope_cameras, done_cameras: t.done_cameras,
      },
      by_lifecycle: LIFECYCLE.map((k) => ({ name: k, count: byLife[k] || 0 })),
      by_status: a.status.map((x) => ({ name: x._id ?? '—', count: x.n })),
      by_division: a.division.map((x) => ({ division: x._id || '—', total: x.total, commissioned: x.commissioned, scope: x.scope, done: x.done })),
      by_zone: a.zone.map((x) => ({ name: x._id ?? '—', count: x.n })),
      hindrance_summary: a.hind.map((x) => ({ name: x._id, count: x.n })),
      upcoming_targets: a.upcoming.map(row),
      handover_pending_list: a.handover.map(row),
      recent_updates: a.recent.map(row),
    });
  }));

  // ------------------------------------------------------------- projects
  const projectId = (req) => {
    const raw = String(req.params.id);
    if (!mongoose.isValidObjectId(raw) || !/^[0-9a-f]{24}$/i.test(raw)) throw new HttpError(404, { error: 'Project not found' });
    return new mongoose.Types.ObjectId(raw);
  };
  const dupProject = () => new HttpError(409, { error: 'A project with this name or code already exists', code: 'duplicate' });

  app.get('/api/projects', wrap(async (req, res) => {
    const { region, q, status, agency, sort, dir } = req.query;
    const filter = {};
    if (region && region !== 'all') filter.region = String(region);
    if (status) filter.status = String(status);
    if (agency) filter.executing_agency = new RegExp(escapeRegex(String(agency)), 'i');
    if (q) { const rx = new RegExp(escapeRegex(String(q)), 'i'); filter.$or = [{ name: rx }, { code: rx }, { executing_agency: rx }]; }
    const docs = await Project.find(filter).lean();
    const light = req.query.stats === '0'; // names only (pickers); skips the station counting
    const stats = light ? {} : await statsByProject(docs.map((d) => d._id));
    let rows = docs.map((d) => projectToApi(d, light ? null : stats[String(d._id)]));
    if (light) return res.json(rows.sort((a, b) => a.name.localeCompare(b.name)));
    const key = { name: (r) => r.name.toLowerCase(), status: (r) => r.status, stations: (r) => r.stats.total,
      commissioned: (r) => r.stats.commissioned, progress: (r) => r.stats.progress, hindrance: (r) => r.stats.hindrance }[sort] || ((r) => r.name.toLowerCase());
    const sign = dir === 'desc' ? -1 : 1;
    rows = rows.sort((a, b) => (key(a) > key(b) ? sign : key(a) < key(b) ? -sign : 0));
    res.json(rows);
  }));

  app.post('/api/projects', wrap(async (req, res) => {
    const user = userName(req.body?.user);
    const p = cleanProject(req.body?.data);
    const errors = validateProject(p);
    if (Object.keys(errors).length) throw new HttpError(422, { errors });
    const now = new Date();
    let doc;
    try {
      doc = (await Project.create({
        ...p, region: REGIONS.includes(req.body?.region) ? req.body.region : DEFAULT_REGION,
        created_at: now, updated_at: now, created_by: user, updated_by: user,
      })).toObject();
    } catch (e) { if (isDuplicateKey(e)) throw dupProject(); throw e; }
    await ProjectHistory.create({ project: doc._id, action: 'create', changed_by: user, changed_at: now, changes: diff({}, p) });
    res.status(201).json(projectToApi(doc, finishStats()));
  }));

  app.get('/api/projects/:id', wrap(async (req, res) => {
    const doc = await Project.findById(projectId(req)).lean();
    if (!doc) throw new HttpError(404, { error: 'Project not found' });
    res.json(projectToApi(doc, (await statsByProject([doc._id]))[String(doc._id)]));
  }));

  app.put('/api/projects/:id', wrap(async (req, res) => {
    const _id = projectId(req);
    const user = userName(req.body?.user);
    const stamp = new Date(req.body?.updated_at);
    if (!req.body?.updated_at || Number.isNaN(stamp.getTime())) throw new HttpError(400, { error: 'updated_at is required' });
    const doc = await Project.findById(_id).lean();
    if (!doc) throw new HttpError(404, { error: 'Project not found' });
    const stale = (cur) => new HttpError(409, { error: 'This project was changed by someone else. Reload to get the latest.', code: 'stale', current: projectToApi(cur, null) });
    if (stamp.getTime() !== doc.updated_at.getTime()) throw stale(doc);
    const change = cleanProject(req.body?.data);
    const next = { ...Object.fromEntries(PROJECT_FIELDS.map((k) => [k, doc[k] ?? null])), ...change };
    const errors = validateProject(next);
    if (Object.keys(errors).length) throw new HttpError(422, { errors });
    const changes = diff(Object.fromEntries(PROJECT_FIELDS.map((k) => [k, doc[k] ?? null])), next);
    const stats = (await statsByProject([_id]))[String(_id)];
    if (!Object.keys(changes).length) return res.json(projectToApi(doc, stats));
    const now = new Date(Math.max(Date.now(), doc.updated_at.getTime() + 1));
    let updated;
    try {
      updated = await Project.findOneAndUpdate({ _id, updated_at: doc.updated_at }, { $set: { ...next, updated_at: now, updated_by: user } }, { returnDocument: 'after' }).lean();
    } catch (e) { if (isDuplicateKey(e)) throw dupProject(); throw e; }
    if (!updated) throw stale((await Project.findById(_id).lean()) || doc);
    await ProjectHistory.create({ project: _id, action: 'update', changed_by: user, changed_at: now, changes });
    res.json(projectToApi(updated, stats));
  }));

  app.get('/api/projects/:id/history', wrap(async (req, res) => {
    const _id = projectId(req);
    const rows = await ProjectHistory.find({ project: _id }).sort({ changed_at: -1, _id: -1 }).lean();
    const sts = await Station.find({ _id: { $in: rows.map((r) => r.station).filter(Boolean) } }, { stn_code: 1, station_name: 1 }).lean();
    const byId = new Map(sts.map((s) => [String(s._id), s]));
    res.json(rows.map((h) => ({
      id: String(h._id), action: h.action, changed_by: h.changed_by, changed_at: h.changed_at.toISOString(), changes: h.changes,
      station: h.station ? { id: String(h.station), stn_code: byId.get(String(h.station))?.stn_code ?? null, station_name: byId.get(String(h.station))?.station_name ?? null } : null,
    })));
  }));

  // Link an existing station (never copies it).
  app.post('/api/projects/:id/stations', wrap(async (req, res) => {
    const project = projectId(req);
    const user = userName(req.body?.user);
    const sid = String(req.body?.station_id || '');
    if (!/^[0-9a-f]{24}$/i.test(sid)) throw new HttpError(400, { error: 'station_id is required' });
    if (!(await Project.exists({ _id: project }))) throw new HttpError(404, { error: 'Project not found' });
    const station = await Station.findById(sid, { stn_code: 1, station_name: 1 }).lean();
    if (!station) throw new HttpError(404, { error: 'Station not found' });
    const now = new Date();
    try {
      await ProjectStation.create({ project, station: station._id, relationship_type: 'primary', source_project_value: null, linked_at: now, linked_by: user });
    } catch (e) { if (isDuplicateKey(e)) throw new HttpError(409, { error: 'This station is already linked to the project', code: 'already_linked' }); throw e; }
    await ProjectHistory.create({ project, station: station._id, action: 'link', changed_by: user, changed_at: now, changes: { station: { from: null, to: `${station.stn_code} ${station.station_name}` } } });
    res.status(201).json({ ok: true });
  }));

  app.delete('/api/projects/:id/stations/:stationId', wrap(async (req, res) => {
    const project = projectId(req);
    const user = userName(req.query.user);
    const sid = String(req.params.stationId);
    if (!/^[0-9a-f]{24}$/i.test(sid)) throw new HttpError(404, { error: 'Station not found' });
    const removed = await ProjectStation.findOneAndDelete({ project, station: sid }).lean();
    if (!removed) throw new HttpError(404, { error: 'This station is not linked to the project' });
    const station = await Station.findById(sid, { stn_code: 1, station_name: 1 }).lean();
    await ProjectHistory.create({ project, station: sid, action: 'unlink', changed_by: user, changed_at: new Date(), changes: { station: { from: station ? `${station.stn_code} ${station.station_name}` : sid, to: null } } });
    res.json({ ok: true }); // the station record itself is untouched
  }));

  // Projects a station belongs to.
  app.get('/api/stations/:id/projects', wrap(async (req, res) => {
    const links = await ProjectStation.find({ station: parseId(req) }).lean();
    const projects = await Project.find({ _id: { $in: links.map((l) => l.project) } }).lean();
    const byId = new Map(projects.map((p) => [String(p._id), p]));
    res.json(links.filter((l) => byId.has(String(l.project))).map((l) => {
      const p = byId.get(String(l.project));
      return { project_id: String(p._id), name: p.name, status: p.status, executing_agency: p.executing_agency ?? null,
        relationship_type: l.relationship_type, source_project_value: l.source_project_value ?? null, linked_at: l.linked_at.toISOString(), linked_by: l.linked_by };
    }));
  }));

  // Delete a station. A full copy (with its project links) goes to the `deleted_stations` collection first, so it can be recovered.
  app.delete('/api/stations/:id', wrap(async (req, res) => {
    const _id = parseId(req);
    const user = userName(req.query.user);
    const doc = await Station.findById(_id).lean();
    if (!doc) throw new HttpError(404, { error: 'Station not found' });
    const links = await ProjectStation.find({ station: _id }).lean();
    const now = new Date();
    await mongoose.connection.db.collection('deleted_stations').insertOne({ station: doc, project_links: links, deleted_by: user, deleted_at: now });
    await ProjectStation.deleteMany({ station: _id });
    await Station.deleteOne({ _id });
    for (const l of links) {
      await ProjectHistory.create({ project: l.project, station: null, action: 'unlink', changed_by: user, changed_at: now, changes: { station_deleted: { from: `${doc.stn_code} ${doc.station_name}`, to: null } } });
    }
    res.json({ ok: true });
  }));

  // Distinct values for the list filters.
  app.get('/api/facets', wrap(async (req, res) => {
    const scope = req.query.region ? { region: String(req.query.region) } : {};
    const d = (f) => Station.distinct(f, scope).then((a) => a.filter(Boolean).sort());
    const [zones, divisions, statuses, states] = await Promise.all([d('zone'), d('division'), d('status'), Station.distinct('data.state', scope).then((a) => a.filter(Boolean).sort())]);
    res.json({ regions: REGIONS, zones, divisions, statuses, lifecycles: LIFECYCLE, states });
  }));

  app.get('/api/stations/:id', wrap(async (req, res) => {
    const doc = await Station.findById(parseId(req)).lean();
    if (!doc) throw new HttpError(404, { error: 'Station not found' });
    res.json(toApi(doc));
  }));

  app.post('/api/stations', wrap(async (req, res) => {
    const user = userName(req.body?.user);
    const data = applyComputed(clean(req.body?.data));
    delete data.sn;
    const draft = req.body?.draft === true;
    const { errors, warnings } = validate(data, { strict: !draft });
    if (draft) for (const k of Object.keys(errors)) if (errors[k] === 'Required' && !['stn_code', 'station_name', 'zone'].includes(k)) delete errors[k];
    if (Object.keys(errors).length) throw new HttpError(422, { errors, warnings });
    const lifecycle = LIFECYCLE.includes(req.body?.lifecycle) ? req.body.lifecycle : 'New';
    const dupError = () => new HttpError(409, { error: 'A station with this zone and code already exists', code: 'duplicate' });
    if (await Station.exists({ zone: data.zone, stn_code: data.stn_code })) throw dupError();

    data.sn = await nextSn();
    const now = new Date();
    let doc;
    try {
      doc = (await Station.create({
        sn: data.sn, stn_code: data.stn_code, station_name: data.station_name, zone: data.zone,
        division: data.division ?? null, status: data.status ?? null, data,
        region: REGIONS.includes(req.body?.region) ? req.body.region : DEFAULT_REGION,
        created_at: now, updated_at: now, updated_by: user, created_by: user, lifecycle, draft, origin: 'application',
      })).toObject();
    } catch (e) {
      if (isDuplicateKey(e)) throw dupError();
      throw e;
    }
    await StationHistory.create({ station_id: doc._id, action: 'create', changed_by: user, changed_at: now, changes: diff({}, data) });
    // Created from a project (or with one chosen in the wizard): link it, still one canonical station.
    const pid = String(req.body?.project_id || '');
    if (/^[0-9a-f]{24}$/i.test(pid) && (await Project.exists({ _id: pid }))) {
      await ProjectStation.create({ project: pid, station: doc._id, relationship_type: 'primary', source_project_value: null, linked_at: now, linked_by: user });
      await ProjectHistory.create({ project: pid, station: doc._id, action: 'link', changed_by: user, changed_at: now, changes: { station: { from: null, to: `${doc.stn_code} ${doc.station_name}` } } });
    }
    res.status(201).json({ ...toApi(doc), warnings });
  }));

  app.put('/api/stations/:id', wrap(async (req, res) => {
    const _id = parseId(req);
    const user = userName(req.body?.user);
    const changed = clean(req.body?.data);
    delete changed.sn;
    const stamp = new Date(req.body?.updated_at);
    if (!req.body?.updated_at || Number.isNaN(stamp.getTime())) throw new HttpError(400, { error: 'updated_at is required' });

    const doc = await Station.findById(_id).lean();
    if (!doc) throw new HttpError(404, { error: 'Station not found' });
    const stale = (current) => new HttpError(409, {
      error: 'This station was changed by someone else. Reload to get the latest.', code: 'stale', current: toApi(current),
    });
    if (stamp.getTime() !== doc.updated_at.getTime()) throw stale(doc);

    const next = applyComputed({ ...doc.data, ...changed });
    next.sn = doc.sn;
    // A draft stays lenient until it is finalised (draft:false), which applies the full creation rules.
    const finalising = doc.draft && req.body?.draft === false;
    const { errors, warnings } = validate(next, { strict: finalising });
    if (doc.draft && !finalising) for (const k of Object.keys(errors)) if (errors[k] === 'Required' && !['stn_code', 'station_name', 'zone'].includes(k)) delete errors[k];
    if (Object.keys(errors).length) throw new HttpError(422, { errors, warnings });

    const changes = diff(doc.data, next);
    const newLife = LIFECYCLE.includes(req.body?.lifecycle) ? req.body.lifecycle : doc.lifecycle;
    if (newLife !== doc.lifecycle) changes.lifecycle = { from: doc.lifecycle ?? null, to: newLife };
    if (finalising) changes.draft = { from: true, to: false };
    if (!Object.keys(changes).length) return res.json({ ...toApi(doc), warnings });

    const now = new Date(Math.max(Date.now(), doc.updated_at.getTime() + 1));
    let updated;
    try {
      // updated_at in the filter makes this an atomic compare-and-set: it only writes if nobody saved in between.
      updated = await Station.findOneAndUpdate(
        { _id, updated_at: doc.updated_at },
        { $set: {
          stn_code: next.stn_code, station_name: next.station_name, zone: next.zone, division: next.division ?? null,
          status: next.status ?? null, data: next, updated_by: user, updated_at: now,
          lifecycle: newLife ?? deriveLifecycle(next), draft: finalising ? false : !!doc.draft,
        } },
        { returnDocument: 'after' },
      ).lean();
    } catch (e) {
      if (isDuplicateKey(e)) throw new HttpError(409, { error: 'A station with this zone and code already exists', code: 'duplicate' });
      throw e;
    }
    if (!updated) throw stale((await Station.findById(_id).lean()) || doc);
    await StationHistory.create({ station_id: _id, action: 'update', changed_by: user, changed_at: now, changes });
    res.json({ ...toApi(updated), warnings });
  }));

  app.get('/api/stations/:id/history', wrap(async (req, res) => {
    const rows = await StationHistory.find({ station_id: parseId(req) }).sort({ changed_at: -1, _id: -1 }).lean();
    res.json(rows.map((h) => ({
      id: String(h._id), station_id: String(h.station_id), action: h.action,
      changed_by: h.changed_by, changed_at: h.changed_at.toISOString(), changes: h.changes,
    })));
  }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json(err.body);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  });

  return app;
}

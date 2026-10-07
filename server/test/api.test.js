// Runs against a throwaway in-memory MongoDB (downloaded once by mongodb-memory-server),
// or against MONGODB_TEST_URI if you set it. It never touches your real cluster.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, disconnect } from '../db.js';
import { createApp } from '../app.js';

let mongod; let server; let base;

const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) { mongod = await MongoMemoryServer.create(); uri = mongod.getUri(); }
  await connect(uri, 'cctv_test');
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  // When pointed at a real cluster (MONGODB_TEST_URI), leave nothing behind in the throwaway test database.
  if (process.env.MONGODB_TEST_URI) await mongoose.connection.dropDatabase();
  await disconnect();
  await mongod?.stop();
});

const station = {
  stn_code: 'test', station_name: 'Test Station', zone: 'NR', division: 'DLI', state: 'Delhi',
  server_thana: 'Test Thana', server_thana_code: 'tst', status: 'Go Live',
  scope_dome: 0, scope_fixed: 9, scope_ptz: 1, scope_k4: 0, install_month: 'Jan', install_year: 2025,
};

test('health check', async () => {
  assert.deepEqual((await call('GET', '/health')).body, { ok: true, database: 'cctv_test' });
});

test('create: auto fields, S.N., string id, history', async () => {
  const r = await call('POST', '/stations', { data: station, user: 'alice' });
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^[0-9a-f]{24}$/);
  assert.equal(r.body.sn, 1);
  assert.equal(r.body.stn_code, 'TEST');
  assert.equal(r.body.data.scope_total, 10);
  assert.equal(r.body.data.monitoring_thana, 'Test Thana');
  assert.equal(r.body.data.commissioned, 'Go Live');
  const h = await call('GET', `/stations/${r.body.id}/history`);
  assert.equal(h.body[0].action, 'create');
  assert.equal(h.body[0].changed_by, 'alice');
});

test('create: user defaults to Operator, validates, rejects duplicates, ignores unknown keys', async () => {
  const bad = await call('POST', '/stations', { data: { ...station, station_name: '', stn_code: 'X1' } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.errors.station_name);
  assert.equal((await call('POST', '/stations', { data: station })).status, 409);
  const ok = await call('POST', '/stations', { data: { ...station, stn_code: 'UNK', bogus: 1 } });
  assert.equal(ok.status, 201);
  assert.equal('bogus' in ok.body.data, false);
  assert.equal(ok.body.updated_by, 'Operator');
  assert.equal(ok.body.sn, 2);
});

test('update: diff history, warnings still save, 409 when stale, 422 on errors, no-op leaves it alone', async () => {
  const list = (await call('GET', '/stations?q=Test%20Thana')).body;
  const id = list.find((s) => s.stn_code === 'TEST').id;
  const rec = (await call('GET', `/stations/${id}`)).body;

  const ok = await call('PUT', `/stations/${id}`, { data: { done_fixed: 12 }, user: 'bob', updated_at: rec.updated_at });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.warnings.done_fixed, 'Exceeds scope (9)');
  assert.equal(ok.body.data.done_total, 12);
  assert.equal(ok.body.sn, 1);

  const h = (await call('GET', `/stations/${id}/history`)).body;
  assert.equal(h[0].action, 'update');
  assert.deepEqual(Object.keys(h[0].changes).sort(), ['done_fixed', 'done_total']);

  const stale = await call('PUT', `/stations/${id}`, { data: { remarks: 'x' }, user: 'carol', updated_at: rec.updated_at });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.current.id, id);

  const fresh = ok.body.updated_at;
  assert.equal((await call('PUT', `/stations/${id}`, { data: { station_name: '' }, updated_at: fresh })).status, 422);
  assert.equal((await call('PUT', `/stations/${id}`, { data: { done_dome: -1 }, updated_at: fresh })).status, 422);

  const noop = await call('PUT', `/stations/${id}`, { data: { done_fixed: 12 }, updated_at: fresh });
  assert.equal(noop.status, 200);
  assert.equal(noop.body.updated_at, fresh);
  assert.equal((await call('GET', `/stations/${id}/history`)).body.length, 2);
});

test('two saves at the same moment: exactly one wins (atomic compare-and-set)', async () => {
  const id = (await call('GET', '/stations')).body[0].id;
  const rec = (await call('GET', `/stations/${id}`)).body;
  const [a, b] = await Promise.all([
    call('PUT', `/stations/${id}`, { data: { remarks: 'from A' }, user: 'A', updated_at: rec.updated_at }),
    call('PUT', `/stations/${id}`, { data: { remarks: 'from B' }, user: 'B', updated_at: rec.updated_at }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
});

test('S.N. never repeats under concurrent creates', async () => {
  const made = await Promise.all(['C1', 'C2', 'C3', 'C4', 'C5'].map((code) => call('POST', '/stations', { data: { ...station, stn_code: code } })));
  const sns = made.map((m) => m.body.sn);
  assert.equal(new Set(sns).size, 5);
});

test('list: summaries, full records, filters, bad ids', async () => {
  const sum = await call('GET', '/stations?zone=NR&division=DLI&status=Go%20Live');
  assert.ok(sum.body.length >= 1);
  assert.ok('progress' in sum.body[0] && 'scope_total' in sum.body[0] && !('data' in sum.body[0]));
  const full = await call('GET', '/stations?full=1');
  assert.ok('data' in full.body[0]);
  assert.equal((await call('GET', '/stations?division=LKO')).body.length, 0);
  assert.equal((await call('GET', '/stations/not-an-id')).status, 404);
  assert.equal((await call('GET', '/stations/aaaaaaaaaaaaaaaaaaaaaaaa')).status, 404);
});

test('commissioned stations need an install month/year; handover Y needs a date', async () => {
  const r = await call('POST', '/stations', { data: { ...station, stn_code: 'RULE1', install_month: null, install_year: null } });
  assert.equal(r.status, 422);
  assert.ok(r.body.errors.install_month);
  const h = await call('POST', '/stations', { data: { ...station, stn_code: 'RULE2', handed_over: 'Y' } });
  assert.equal(h.status, 422);
  assert.ok(h.body.errors.handover_date);
});

test('draft: saves without fake values, then finalising applies the full rules', async () => {
  const d = await call('POST', '/stations', { draft: true, data: { stn_code: 'drf1', station_name: 'Draft One', zone: 'NR' } });
  assert.equal(d.status, 201);
  assert.equal(d.body.draft, true);
  assert.equal(d.body.lifecycle, 'New');
  assert.equal(d.body.origin, 'application');
  const noName = await call('POST', '/stations', { draft: true, data: { stn_code: 'drf2', zone: 'NR' } });
  assert.equal(noName.status, 422);
  const fin = await call('PUT', `/stations/${d.body.id}`, { updated_at: d.body.updated_at, draft: false, data: {} });
  assert.equal(fin.status, 422); // division/state missing
  const ok = await call('PUT', `/stations/${d.body.id}`, { updated_at: d.body.updated_at, draft: false, data: { division: 'DLI', state: 'Delhi', status: 'Not Live' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.draft, false);
});

test('list paging, sorting, views and dashboard', async () => {
  const p = await call('GET', '/stations?page=1&pageSize=2&sort=stn_code&dir=desc');
  assert.equal(p.status, 200);
  assert.ok(p.body.items.length <= 2 && p.body.total >= 3 && p.body.pages >= 2);
  assert.ok(p.body.items[0].stn_code >= (p.body.items[1]?.stn_code ?? ''));
  const c = await call('GET', '/stations?view=commissioned&page=1');
  assert.ok(c.body.items.every((s) => ['Completed', 'Go Live'].includes(s.status)));
  const dash = await call('GET', '/dashboard');
  assert.ok(dash.body.totals.stations >= 3);
  assert.equal(dash.body.by_lifecycle.length, 10);
  const f = await call('GET', '/facets');
  assert.ok(f.body.zones.includes('NR'));
});

test('regions: stations default to NR, can be created in another region, and every list/dashboard follows the region', async () => {
  const nr = await call('POST', '/stations', { data: { ...station, stn_code: 'REG1' } });
  assert.equal(nr.body.region, 'NR');
  const er = await call('POST', '/stations', { region: 'ER', data: { ...station, stn_code: 'REG2', zone: 'ER' } });
  assert.equal(er.status, 201);
  assert.equal(er.body.region, 'ER');
  const erList = await call('GET', '/stations?region=ER&page=1');
  assert.deepEqual(erList.body.items.map((s) => s.stn_code), ['REG2']);
  assert.ok((await call('GET', '/stations?region=NR&page=1')).body.items.every((s) => s.region === 'NR'));
  assert.equal((await call('GET', '/stations?region=SR&page=1')).body.total, 0);
  assert.equal((await call('GET', '/dashboard?region=ER')).body.totals.stations, 1);
  assert.deepEqual((await call('GET', '/facets?region=ER')).body.zones, ['ER']);
  const bad = await call('POST', '/stations', { region: 'XX', data: { ...station, stn_code: 'REG3' } });
  assert.equal(bad.body.region, 'NR');
});

test('projects: create, validate, link without duplicating, create-from-project, unlink, history, stats', async () => {
  const bad = await call('POST', '/projects', { data: { name: '', type: 'VSS' } });
  assert.equal(bad.status, 422);
  const p = await call('POST', '/projects', { user: 'amy', data: { name: 'Proj A', type: 'VSS', executing_agency: 'RailTel', start_date: '2026-01-01', target_completion_date: '2026-12-31' } });
  assert.equal(p.status, 201);
  assert.equal((await call('POST', '/projects', { data: { name: 'Proj A', type: 'VSS' } })).status, 409);
  assert.equal((await call('POST', '/projects', { data: { name: 'Proj Bad', start_date: '2026-05-01', target_completion_date: '2026-01-01' } })).status, 422);

  const before = (await call('GET', '/stations?page=1')).body.total;
  const s1 = await call('POST', '/stations', { data: { ...station, stn_code: 'PRJ1' }, project_id: p.body.id });
  assert.equal(s1.status, 201);
  const list = await call('GET', `/stations?project=${p.body.id}&page=1`);
  assert.deepEqual(list.body.items.map((s) => s.stn_code), ['PRJ1']);

  const other = await call('POST', '/projects', { data: { name: 'Proj B', type: 'Nirbhaya' } });
  const link = await call('POST', `/projects/${other.body.id}/stations`, { station_id: s1.body.id, user: 'amy' });
  assert.equal(link.status, 201);
  assert.equal((await call('POST', `/projects/${other.body.id}/stations`, { station_id: s1.body.id })).status, 409);
  assert.equal((await call('GET', '/stations?page=1')).body.total, before + 1); // no duplicate station
  const sp = await call('GET', `/stations/${s1.body.id}/projects`);
  assert.equal(sp.body.length, 2);

  const pj = await call('GET', `/projects/${p.body.id}`);
  assert.equal(pj.body.stats.total, 1);
  assert.equal(pj.body.stats.commissioned, 1);
  const up = await call('PUT', `/projects/${p.body.id}`, { updated_at: pj.body.updated_at, user: 'amy', data: { status: 'On Hold' } });
  assert.equal(up.status, 200);
  assert.equal((await call('PUT', `/projects/${p.body.id}`, { updated_at: pj.body.updated_at, data: { status: 'Active' } })).status, 409);

  assert.equal((await call('DELETE', `/projects/${other.body.id}/stations/${s1.body.id}?user=amy`)).status, 200);
  assert.equal((await call('GET', `/stations/${s1.body.id}`)).status, 200); // station survives unlinking
  const h = await call('GET', `/projects/${other.body.id}/history`);
  assert.deepEqual(h.body.map((x) => x.action), ['unlink', 'link', 'create']);
  const none = await call('GET', '/stations?project=none&page=1');
  assert.ok(none.body.items.every((s) => s.stn_code !== 'PRJ1'));
  const lst = await call('GET', '/projects?type=VSS');
  assert.ok(lst.body.some((x) => x.name === 'Proj A' && x.stats.total === 1));
});

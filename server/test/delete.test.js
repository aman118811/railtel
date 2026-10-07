// Same setup as api.test.js: throwaway in-memory MongoDB, never touches the real cluster.
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
  await connect(uri, 'cctv_test_delete');
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  server = createApp().listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => {
  server?.close();
  if (process.env.MONGODB_TEST_URI) await mongoose.connection.dropDatabase();
  await disconnect();
  await mongod?.stop();
});

const station = { stn_code: 'del1', station_name: 'Delete Me', zone: 'NR', division: 'DLI', state: 'Delhi', status: 'Not Live' };

test('delete station: archived copy, links removed, project history, code reusable', async () => {
  const p = await call('POST', '/projects', { data: { name: 'Del Proj', type: 'Other' } });
  const s = await call('POST', '/stations', { data: station, project_id: p.body.id });
  assert.equal(s.status, 201);
  assert.equal((await call('DELETE', `/stations/${s.body.id}?user=amy`)).status, 200);
  assert.equal((await call('GET', `/stations/${s.body.id}`)).status, 404);
  assert.equal((await call('DELETE', `/stations/${s.body.id}`)).status, 404);
  assert.equal((await call('GET', `/projects/${p.body.id}`)).body.stats.total, 0);
  const archived = await mongoose.connection.db.collection('deleted_stations').findOne({ 'station.stn_code': 'DEL1' });
  assert.equal(archived.deleted_by, 'amy');
  assert.equal(archived.project_links.length, 1);
  const h = await call('GET', `/projects/${p.body.id}/history`);
  assert.ok(h.body.some((x) => x.action === 'unlink' && x.changes.station_deleted));
  assert.equal((await call('POST', '/stations', { data: station })).status, 201); // code can be reused
});

// Inserts the single dummy TEST station (no real station data) through the API code, so it gets
// the same validation, S.N. and history entry as a station created in the browser.
import { connect, disconnect } from './db.js';
import { createApp } from './app.js';
import { applyComputed, defaultsFor } from '../shared/fields.js';

await connect();
const server = createApp().listen(0);
try {
  const data = applyComputed({
    ...defaultsFor(),
    stn_code: 'TEST', station_name: 'Test Station', zone: 'NR', division: 'DLI', state: 'Delhi',
    server_thana: 'Test Thana', server_thana_code: 'TST', status: 'Go Live',
    scope_dome: 0, scope_fixed: 9, scope_ptz: 1, scope_k4: 0,
  });
  const res = await fetch(`http://localhost:${server.address().port}/api/stations`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, user: 'seed' }),
  });
  const body = await res.json();
  if (res.status === 201) console.log('Inserted TEST station (S.N. %d).', body.sn);
  else if (res.status === 409) console.log('TEST station already exists.');
  else console.log('Seed failed:', res.status, body);
} finally {
  server.close();
  await disconnect();
}

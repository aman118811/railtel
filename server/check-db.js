// Connection check: `npm run check-db`. Connects with MONGODB_URI, pings, and reports what it found.
// Prints the cluster host and database name only, never the credentials.
import mongoose from 'mongoose';
import { connect, describeConnection, disconnect } from './db.js';
import { Station, StationHistory } from './models/index.js';

try {
  const conn = await connect();
  await conn.db.admin().ping();
  console.log(`OK  connected to ${describeConnection(conn)}`);
  console.log(`OK  ping succeeded (server ${(await conn.db.admin().serverInfo()).version})`);
  const names = (await conn.db.listCollections().toArray()).map((c) => c.name);
  console.log(`    collections: ${names.length ? names.join(', ') : '(none yet; they are created on first save)'}`);
  console.log(`    stations: ${await Station.countDocuments()}   history rows: ${await StationHistory.countDocuments()}`);
  const idx = await Station.collection.indexes();
  console.log(`OK  indexes on stations: ${idx.map((i) => i.name).join(', ')}`);
  await disconnect();
} catch (e) {
  console.error(`FAIL ${e.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}

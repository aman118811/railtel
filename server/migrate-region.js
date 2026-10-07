import { connect, disconnect } from './db.js';
import { Station } from './models/index.js';
await connect();
try {
  const r = await Station.collection.updateMany({ region: { $exists: false } }, { $set: { region: 'NR' } });
  console.log('region set to NR on', r.modifiedCount, 'stations; total NR =', await Station.countDocuments({ region: 'NR' }));
} finally { await disconnect(); }

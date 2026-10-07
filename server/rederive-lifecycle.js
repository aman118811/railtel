// Re-derives the lifecycle for stations still in their imported, untouched state (updated_by "Excel import" / "Migration").
import { connect, disconnect } from './db.js';
import { Station } from './models/index.js';
import { deriveLifecycle, applyComputed } from '../shared/fields.js';
const WRITE = process.argv.includes('--write');
await connect();
try {
  const docs = await Station.find({ origin: 'excel_import' }, { data: 1, lifecycle: 1, updated_by: 1 }).lean();
  const tally = {}; let changed = 0;
  for (const d of docs) {
    const l = deriveLifecycle(applyComputed(d.data));
    tally[l] = (tally[l] || 0) + 1;
    if (l !== d.lifecycle && ['Excel import', 'Migration'].includes(d.updated_by)) {
      changed += 1;
      if (WRITE) await Station.updateOne({ _id: d._id }, { $set: { lifecycle: l } });
    }
  }
  console.log(WRITE ? 'updated' : 'would update', changed, JSON.stringify(tally));
} finally { await disconnect(); }

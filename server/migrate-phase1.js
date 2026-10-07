// Sets has_phase1 = "Y" for imported stations that have Non-STQC (Phase-1) camera counts in the sheet.
// The sheet has no such flag; the app needs it to show the Non-STQC section. Logged in station_history.
import { connect, disconnect } from './db.js';
import { Station, StationHistory } from './models/index.js';
const WRITE = process.argv.includes('--write');
const keys = ['p1_dome', 'p1_fixed', 'p1_ptz', 'p1_k4', 'p1_yard', 'p1_panic', 'p1_va', 'p1_frs'];
await connect();
try {
  const docs = await Station.find({}, { data: 1 }).lean();
  let n = 0;
  for (const d of docs) {
    const x = d.data || {};
    if (x.has_phase1) continue;
    const any = keys.some((k) => Number(x[k]) > 0);
    if (!any) continue;
    n += 1;
    if (!WRITE) continue;
    await Station.updateOne({ _id: d._id }, { $set: { 'data.has_phase1': 'Y' } });
    await StationHistory.create({ station_id: d._id, action: 'update', changed_by: 'Migration', changed_at: new Date(), changes: { has_phase1: { from: null, to: 'Y' } } });
  }
  console.log(`${n} of ${docs.length} stations have Non-STQC camera counts${WRITE ? ' -> has_phase1 set to Y' : ' (dry run)'}`);
} finally { await disconnect(); }

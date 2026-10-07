// Creates Project records and ProjectStation links from each station's original Excel value of
// "under which work done/Proposed" (stored as data.scheme). Station records are NOT modified.
//   node migrate-projects.js                       dry run + report
//   node migrate-projects.js --write
//   node migrate-projects.js --write --map "D&E Ctg stns=VSS" --map "RailTel-D&E=VSS"   (only when YOU confirm those texts)
import { connect, disconnect } from './db.js';
import { Project, ProjectStation, ProjectHistory, Station } from './models/index.js';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const extra = {};
args.forEach((a, i) => { if (a === '--map') { const [k, v] = String(args[i + 1]).split('='); extra[k.trim()] = v.trim(); } });

const PROJECTS = {
  VSS: { name: 'VSS – RailTel – D&E Category Stations', type: 'VSS', code: 'VSS', sources: ['VSS-RailTel-D&E Ctg stns', 'VSS RailTel-DE Category Station'] },
  Nirbhaya: { name: 'Nirbhaya – RailTel', type: 'Nirbhaya', code: 'NIRBHAYA', sources: ['Nirbhaya-RailTel'] },
};
const projectFor = (text) => {
  if (!text) return null;
  const t = String(text).trim();
  for (const [k, p] of Object.entries(PROJECTS)) if (p.sources.includes(t)) return k;
  return extra[t] && PROJECTS[extra[t]] ? extra[t] : null;
};

await connect();
try {
  const stations = await Station.find({}, { stn_code: 1, zone: 1, region: 1, 'data.scheme': 1 }).lean();
  const plan = { VSS: [], Nirbhaya: [] };
  const unmatched = {};
  for (const s of stations) {
    const text = s.data?.scheme ?? null;
    const key = projectFor(text);
    if (key) plan[key].push({ s, text });
    else { const k = text === null || text === '' ? '(blank)' : String(text); (unmatched[k] ||= []).push(`${s.zone}/${s.stn_code}`); }
  }
  console.log(`${stations.length} stations`);
  for (const [k, rows] of Object.entries(plan)) console.log(`  -> ${PROJECTS[k].name}: ${rows.length}`);
  console.log('Not linked (no guess made):');
  for (const [k, ids] of Object.entries(unmatched)) console.log(`  ${JSON.stringify(k)}: ${ids.length} stations${ids.length <= 4 ? ' ' + ids.join(', ') : ''}`);
  if (!WRITE) { console.log('\nDry run only. Add --write to apply.'); process.exit(0); }

  const now = new Date();
  for (const [k, rows] of Object.entries(plan)) {
    const p = PROJECTS[k];
    const sources = [...new Set([...p.sources, ...Object.keys(extra).filter((x) => extra[x] === k)])];
    const project = await Project.findOneAndUpdate(
      { region: 'NR', name: p.name },
      { $setOnInsert: { region: 'NR', code: p.code, name: p.name, type: p.type, status: 'Active', created_at: now, created_by: 'Migration' }, $set: { updated_at: now, updated_by: 'Migration', source_values: sources } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    let linked = 0;
    for (const { s, text } of rows) {
      const r = await ProjectStation.updateOne(
        { project: project._id, station: s._id },
        { $setOnInsert: { project: project._id, station: s._id, relationship_type: 'primary', source_project_value: text, linked_at: now, linked_by: 'Migration' } },
        { upsert: true },
      );
      if (r.upsertedCount) linked += 1;
    }
    if (linked) await ProjectHistory.create({ project: project._id, action: 'create', changed_by: 'Migration', changed_at: now, changes: { linked_stations: { from: 0, to: linked }, source_values: { from: null, to: sources.join(' | ') } } });
    console.log(`${p.name}: ${linked} new links (project id ${project._id})`);
  }
  console.log('Links total:', await ProjectStation.countDocuments(), '| stations unchanged:', await Station.countDocuments());
} finally {
  await disconnect();
}

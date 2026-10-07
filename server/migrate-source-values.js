// One-off, safe migration for already-imported stations:
//  1. backs up the whole `stations` collection to server/backups/
//  2. stores the sheet's own values for the recalculated columns (A, P, AA, AN, AO) as data.src_*
//  3. sets origin / created_by / lifecycle (derived from the sheet values, see deriveLifecycle)
// Nothing else in `data` is touched. Each change is logged in station_history (changed_by "Migration").
//   node migrate-source-values.js <file.md>            dry run
//   node migrate-source-values.js <file.md> --write
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deriveLifecycle, applyComputed } from '../shared/fields.js';
import { connect, disconnect } from './db.js';
import { Station, StationHistory } from './models/index.js';

const [file, ...flags] = process.argv.slice(2);
const WRITE = flags.includes('--write');
if (!file) { console.error('Usage: node migrate-source-values.js <file.md> [--write]'); process.exit(1); }

const text = fs.readFileSync(file, 'utf8');
const letterOf = {};
for (const m of text.matchAll(/^\| `(C\d{3})` \| `([A-Z]+)` \|/gm)) letterOf[m[1]] = m[2];
const lines = text.split('```tsv')[1].split('```')[0].trim().split(/\r?\n/);
const letters = lines[0].split('\t').slice(1).map((c) => letterOf[c]);
const idx = (l) => letters.indexOf(l) + 1;
const SRC = { A: 'src_sn', P: 'src_scope_total', AA: 'src_done_total', AN: 'src_commissioned', AO: 'src_p1_total' };

const fromSheet = new Map(); // "ZONE|CODE" -> { src_* }
for (const line of lines.slice(1)) {
  const c = line.split('\t');
  while (c.length < 161 && c.length > 100) c.push('');
  const key = `${c[idx('I')].trim()}|${c[idx('B')].trim().toUpperCase()}`;
  if (fromSheet.has(key)) continue; // first occurrence only (the importer skipped later duplicates)
  const o = {};
  for (const [l, k] of Object.entries(SRC)) { const v = c[idx(l)].trim(); if (v !== '') o[k] = v; }
  fromSheet.set(key, o);
}

await connect();
try {
  const docs = await Station.find({}).lean();
  console.log(`${docs.length} stations in database, ${fromSheet.size} in the file.`);

  if (WRITE) {
    const dir = fileURLToPath(new URL('./backups/', import.meta.url));
    fs.mkdirSync(dir, { recursive: true });
    const out = `${dir}stations-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(out, JSON.stringify(docs));
    console.log(`Backup written: ${out}`);
  }

  let touched = 0; let noMatch = 0; let withSrc = 0;
  const life = {};
  for (const d of docs) {
    const src = fromSheet.get(`${d.zone}|${d.stn_code}`);
    if (!src) { noMatch += 1; }
    const data = { ...d.data, ...(src || {}) };
    const lifecycle = d.lifecycle || deriveLifecycle(applyComputed(data));
    life[lifecycle] = (life[lifecycle] || 0) + 1;
    if (src && Object.keys(src).length) withSrc += 1;
    const changes = {};
    for (const [k, v] of Object.entries(src || {})) if (d.data?.[k] !== v) changes[k] = { from: d.data?.[k] ?? null, to: v };
    touched += 1;
    if (!WRITE) continue;
    await Station.updateOne({ _id: d._id }, {
      $set: {
        ...Object.fromEntries(Object.entries(src || {}).map(([k, v]) => [`data.${k}`, v])),
        lifecycle, origin: d.origin === 'application' && d.updated_by !== 'Excel import' ? d.origin : 'excel_import',
        created_by: d.created_by || d.updated_by || 'Excel import',
      },
    });
    if (Object.keys(changes).length) {
      await StationHistory.create({ station_id: d._id, action: 'update', changed_by: 'Migration', changed_at: new Date(), changes });
    }
  }
  console.log(`${touched} processed, ${withSrc} with source values, ${noMatch} not found in file.`);
  console.log('Lifecycle:', JSON.stringify(life));
  if (!WRITE) console.log('Dry run only. Add --write to apply.');
} finally {
  await disconnect();
}

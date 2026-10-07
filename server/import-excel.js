// Imports the "Commissioned stations NR" sheet (exported as Markdown/TSV) into MongoDB.
//   npm --prefix server run import -- "C:\path\to\Commissioned_stations_NR_complete_data.md"          (dry run)
//   npm --prefix server run import -- "C:\path\to\file.md" --write                                   (writes)
// Columns are mapped by Excel column letter using the `col` of each field in shared/fields.js.
// Values are kept as in the sheet (nothing renamed or invented); only numbers and dates are normalised.
import fs from 'node:fs';
import { FIELDS, applyComputed } from '../shared/fields.js';
import { connect, disconnect } from './db.js';
import { Station, Counter } from './models/index.js';

const [file, ...flags] = process.argv.slice(2);
const WRITE = flags.includes('--write');
if (!file) { console.error('Usage: node import-excel.js <file.md> [--write]'); process.exit(1); }

const text = fs.readFileSync(file, 'utf8');

// 1) column schema: Cxxx -> Excel letter
const letterOf = {};
for (const m of text.matchAll(/^\| `(C\d{3})` \| `([A-Z]+)` \|/gm)) letterOf[m[1]] = m[2];

// 2) TSV block
const tsv = text.split('```tsv')[1].split('```')[0].trim().split(/\r?\n/);
const header = tsv[0].split('\t');
const letters = header.slice(1).map((c) => letterOf[c]);
if (letters.length !== 160 || letters.some((l) => !l)) throw new Error('Column schema does not match the TSV header');

// 3) Excel letter -> form field (the hidden/auto "AN" column is recomputed from status)
const fieldOf = {};
for (const f of FIELDS) if (f.col && f.col !== '—' && f.type !== 'auto') fieldOf[f.col] = f;

const MONTHS = { jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec' };
const iso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const validIso = (s) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };

function toDate(raw) {
  let m;
  if (/^\d{5}$/.test(raw)) { // Excel serial number
    const d = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if ((m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?: 00:00:00)?$/))) return validIso(`${m[1]}-${m[2]}-${m[3]}`) ? raw.slice(0, 10) : raw;
  if ((m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/))) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const s = iso(y, m[2], m[1]);
    return validIso(s) ? s : raw;
  }
  return raw;
}

function convert(field, raw) {
  const v = raw.trim();
  if (v === '') return undefined;
  switch (field.type) {
    case 'count': case 'metres': case 'year':
      return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    case 'date': return toDate(v);
    case 'select':
      if (field.options?.includes(v)) return v;
      if (field.options === undefined) return v;
      if (field.key === 'install_month' || field.key === 'p1_month') return MONTHS[v.slice(0, 3).toLowerCase()] || v;
      return field.options.find((o) => o.toLowerCase() === v.toLowerCase()) || v;
    default: return v;
  }
}

// 4) rows
const rows = [];
const problems = [];
for (const line of tsv.slice(1)) {
  const cells = line.split('\t');
  while (cells.length < 161 && cells.length > 100) cells.push(''); // trailing empty cells may be trimmed
  if (cells.length !== 161) { problems.push(`Excel row ${cells[0]}: ${cells.length} cells, expected 161 (skipped)`); continue; }
  const data = {};
  letters.forEach((letter, i) => {
    const f = fieldOf[letter];
    if (!f) return;
    const v = convert(f, cells[i + 1]);
    if (v !== undefined) data[f.key] = v;
  });
  const sn = Number(cells[1]);
  data.sn = sn;
  rows.push({ excelRow: cells[0], sn, data });
}

// 5) duplicates (unique index is zone + stn_code)
const seen = new Map();
const keep = [];
for (const r of rows) {
  const d = r.data;
  if (!d.stn_code || !d.station_name || !d.zone) { problems.push(`Excel row ${r.excelRow}: missing code/name/zone (skipped)`); continue; }
  const k = `${d.zone}|${String(d.stn_code).toUpperCase()}`;
  if (seen.has(k)) { problems.push(`Excel row ${r.excelRow}: duplicate of Excel row ${seen.get(k)} (${k}) (skipped)`); continue; }
  seen.set(k, r.excelRow);
  keep.push(r);
}

console.log(`Parsed ${rows.length} rows; ${keep.length} importable; ${problems.length} skipped.`);
problems.forEach((p) => console.log('  - ' + p));
if (!WRITE) { console.log('\nDry run only. Add --write to save to MongoDB.'); process.exit(0); }

// 6) write
await connect();
try {
  let added = 0; let existing = 0;
  const now = new Date();
  for (let i = 0; i < keep.length; i += 200) {
    const batch = [];
    for (const r of keep.slice(i, i + 200)) {
      const data = applyComputed(r.data);
      if (await Station.exists({ zone: data.zone, stn_code: data.stn_code })) { existing += 1; continue; }
      batch.push({
        sn: r.sn, stn_code: data.stn_code, station_name: data.station_name, zone: data.zone,
        division: data.division ?? null, status: data.status ?? null, data,
        created_at: now, updated_at: now, updated_by: 'Excel import',
      });
    }
    if (batch.length) { await Station.insertMany(batch, { ordered: false }); added += batch.length; }
  }
  const top = await Station.findOne({}, { sn: 1 }).sort({ sn: -1 }).lean();
  await Counter.findOneAndUpdate({ _id: 'stations' }, { $set: { seq: top?.sn || 0 } }, { upsert: true });
  console.log(`\nSaved ${added} stations (${existing} already existed). Total in database: ${await Station.countDocuments()}.`);
} finally {
  await disconnect();
}

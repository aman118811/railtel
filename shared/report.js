// Report definitions and the pure function that builds both summary tables from station
// records. Everything is derived from the form data, so the report is always current.
// To change a definition (what counts as "dropped", a new column, another table), edit here only.
import { isEmpty } from './fields.js';

export const DROPPED_HINDRANCE = ['Station dropped', 'Removed from scope'];
export const NO_HINDRANCE = ['No Hindrance', 'Feasible', 'NA'];

// A station is "dropped" if its status is Removed or its hindrance type says so.
const isDropped = (r) => r.status === 'Removed' || DROPPED_HINDRANCE.includes(r.data?.hindrance_type);
const hasHindranceType = (r) => !isEmpty(r.data?.hindrance_type) && !NO_HINDRANCE.includes(r.data.hindrance_type) && !DROPPED_HINDRANCE.includes(r.data.hindrance_type);

// Counted columns. test(record) -> true if the station counts in this column.
export const COUNTS = {
  a: { test: () => true },
  b: { test: (r) => !isDropped(r) && r.status === 'Completed' },
  c: { test: (r) => !isDropped(r) && r.status === 'Go Live' },
  hindrance: { test: (r) => !isDropped(r) && r.status === 'Under Hindrance' },
  partial_hindrance: { test: (r) => !isDropped(r) && r.status === 'Go Live' && hasHindranceType(r) },
  dropped: { test: isDropped },
  new_station: { test: (r) => r.data?.new_beyond_scope === 'Y' },
  // Not tracked by any form field yet, so it is left blank rather than guessed.
  upgraded: { test: null },
};

// Derived columns, so every number in the report can be opened as a list of stations.
COUNTS.d = { test: (r) => COUNTS.b.test(r) || COUNTS.c.test(r) };
COUNTS.e = { test: (r) => !COUNTS.d.test(r) };

/** Short names for the report's counted columns (used for filter chips and links). */
export const BUCKET_LABELS = {
  a: 'All stations in scheme',
  b: 'Completed (full functionalities)',
  c: 'Go Live (partial)',
  d: 'Total provided',
  e: 'Balance',
  hindrance: 'Under hindrance',
  partial_hindrance: 'Go Live with hindrance',
  dropped: 'Dropped',
  new_station: 'New station introduced',
};

export const SCHEME_SHORT = { 'Nirbhaya-RailTel': 'Nirbhaya', 'VSS-RailTel-D&E Ctg stns': 'VSS D&E' };

/** Does a station record belong to this report cell? Any of scheme / zone / bucket may be empty. */
export function matchesReport(rec, { scheme, zone, bucket }) {
  if (scheme && rec.data?.scheme !== scheme) return false;
  if (zone && rec.zone !== zone) return false;
  if (bucket && COUNTS[bucket]?.test && !COUNTS[bucket].test(rec)) return false;
  return true;
}

const ZONES_ALL =['CR', 'ER', 'ECR', 'ECoR', 'NR', 'NCR', 'NER', 'NWR', 'NFR', 'SCR', 'SER', 'SECR', 'SWR', 'WR', 'WCR'];

export const REPORT_TABLES = [
  {
    id: 'nirbhaya',
    title: 'Total Provided (Nos of Stations)',
    scheme: 'Nirbhaya-RailTel',
    aLabel: 'Stns being executed by RCIL under Nirbhaya Project',
    zones: ZONES_ALL,
    extras: [
      { key: 'hindrance', label: 'Hindrance' },
      { key: 'dropped', label: 'Stn Dropped' },
    ],
  },
  {
    id: 'vss',
    title: 'Details for VSS projects at D & E Ctg Stns',
    scheme: 'VSS-RailTel-D&E Ctg stns',
    aLabel: 'Stns being executed by RCIL under VSS Project',
    zones: ['CR', 'ER', 'ECR', 'NR', 'NCR', 'NER', 'NWR', 'SCR', 'SER', 'SECR', 'WR', 'WCR'],
    extras: [
      { key: 'hindrance', label: 'Hindrance' },
      { key: 'partial_hindrance', label: 'Hindrance for partial go live to full live' },
      { key: 'dropped', label: 'Stn dropped' },
      { key: 'upgraded', label: 'Upgraded to Nirbhaya' },
      { key: 'new_station', label: 'New Station Introduced' },
    ],
  },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const asOfLabel = (d = new Date()) => `${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;

const emptyCounts = (extras) => Object.fromEntries(['a', 'b', 'c', ...extras.map((e) => e.key)].map((k) => [k, 0]));
const finish = (c) => ({ ...c, d: c.b + c.c, e: c.a - (c.b + c.c) });

/** records: full station records ({ zone, status, data }). Returns the tables plus a count of unassigned stations. */
export function buildReport(records, date = new Date()) {
  const schemes = new Set(REPORT_TABLES.map((t) => t.scheme));
  const unassigned = records.filter((r) => !schemes.has(r.data?.scheme)).length;

  const tables = REPORT_TABLES.map((t) => {
    const mine = records.filter((r) => r.data?.scheme === t.scheme);
    const zones = [...t.zones, ...[...new Set(mine.map((r) => r.zone))].filter((z) => !t.zones.includes(z))];
    const keys = Object.keys(emptyCounts(t.extras));
    const rows = zones.map((zone) => {
      const c = emptyCounts(t.extras);
      for (const r of mine.filter((x) => x.zone === zone)) {
        for (const k of keys) if (COUNTS[k].test?.(r)) c[k] += 1;
      }
      return { zone, ...finish(c) };
    });
    const total = finish(Object.fromEntries(['a', 'b', 'c', ...t.extras.map((e) => e.key)].map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)])));
    return { ...t, rows, total };
  });

  return { asOf: asOfLabel(date), tables, unassigned, stationCount: records.length };
}

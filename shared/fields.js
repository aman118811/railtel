// Single source of truth for the CCTV Station Form.
// Imported by the Express API and the React UI: sections, fields, option lists,
// formulas, conditional rules and validation all live here.

/** The sheet's own title (row 2 of "Commissioned stations NR"). */
export const SHEET_TITLE = 'Status of CCTV System at Railway Stations (existing and ongoing/Planned works)';

/** Regions = the sheet tabs ("Commissioned stations ER / NR / SR / WR"). A region holds several zones. */
export const REGIONS = ['ER', 'NR', 'SR', 'WR'];
export const DEFAULT_REGION = 'NR';

// ---------------------------------------------------------------- option lists
export const ZONE_DIVISIONS = {
  NR: ['DLI', 'FZR', 'LKO', 'MB', 'UMB'],
  NCR: ['ALD', 'PRYJ', 'JHS', 'AGC'],
  NER: ['BSB', 'Varanasi', 'IZN', 'Izzatnagar', 'LJN', 'Lucknow'],
  NWR: ['JP', 'Jaipur', 'AII', 'Ajmer', 'BKN', 'Bikaner', 'JU', 'Jodhpur'],
};
export const ALL_DIVISIONS = Array.from(new Set(Object.values(ZONE_DIVISIONS).flat()));

export const OPTIONS = {
  YNNA: ['Y', 'N', 'NA'],
  YN: ['Y', 'N'],
  ZONE: ['NR', 'NCR', 'NER', 'NWR'],
  DIVISION_NR: ['DLI', 'FZR', 'LKO', 'MB', 'UMB'],
  DIVISIONS: ALL_DIVISIONS,
  STATE: [
    'Delhi', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Punjab', 'Uttar Pradesh',
    'Uttarakhand', 'Rajasthan', 'Madhya Pradesh', 'Bihar', 'Chandigarh',
  ],
  OLD_CATEGORY: ['A-1', 'A', 'B', 'C', 'D', 'E', 'F'],
  NEW_CATEGORY: ['NSG-1', 'NSG-2', 'NSG-3', 'NSG-4', 'NSG-5', 'NSG-6', 'SG-1', 'SG-2', 'SG-3', 'HG-1', 'HG-2', 'HG-3'],
  CATEGORY: ['NSG-1', 'NSG-2', 'NSG-3', 'NSG-4', 'NSG-5', 'NSG-6', 'SG-1', 'SG-2', 'SG-3', 'HG-1', 'HG-2', 'HG-3', 'A-1', 'A1', 'A', 'B', 'C', 'D', 'E', 'F'],
  STQC: ['Yes', 'No'],
  MONTH: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  STATUS: ['Completed', 'Go Live', 'Not Live', 'Under Hindrance', 'Removed'],
  SCHEME: ['VSS-RailTel-D&E Ctg stns', 'Nirbhaya-RailTel'],
  HINDRANCE: [
    'No Hindrance', 'Feasible', 'ABSS', 'Thana under ABSS', 'Renovation', 'OFC not available',
    'Flag station', 'Station dropped', 'Removed from scope', 'Other', 'NA',
  ],
  SURVEY_STATUS: ['Approved', 'Done', 'Completed', 'Pending', 'WIP', 'NA'],
  ROOM: ['Available', 'Not available', 'Survey not done', 'NA'],
  POWER: ['AT', 'Civil', 'N', 'Survey not done', 'NA'],
  AC_DG: ['Y', 'N', 'NR', 'Survey not done', 'NA'],
  BATTERY: ['New', 'Replaced', 'Old', 'NA'],
  DRAWING: ['Approved', 'Available', 'Submitted', 'Y', 'N', 'Pending', 'NA'],
  ABD: ['Signed', 'Approved', 'Y', 'N', 'Pending', 'WIP', 'NA'],
  INTEGRATION: ['Live', 'Not Live', 'Y', 'N', 'Pending', 'NA'],
  TRAINING: ['Y', 'N', 'Pending', 'NA'],
  OEM_P1: ['CP Plus', 'Hikvision', 'Other', 'NA'],
  BANDWIDTH: ['8 Mbps', '50 Mbps', '100 Mbps'],
};

// Types: text | longtext | select | count | metres | date | year | auto
// A select with <= BUTTON_MAX options renders as tap buttons, otherwise a <select>. 0 = always a drop-down.
export const BUTTON_MAX = 0;
export const NA = 'NA';

// ------------------------------------------------------------------ helpers
export const isEmpty = (v) => v === undefined || v === null || v === '';
export const sameValue = (a, b) => (isEmpty(a) && isEmpty(b)) || JSON.stringify(a) === JSON.stringify(b);

// "NA", blanks and junk count as 0 in the sums.
const num = (v) => {
  if (isEmpty(v) || v === NA) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const sum = (prefix) => (d) => ['dome', 'fixed', 'ptz', 'k4', 'yard'].reduce((t, k) => t + num(d[`${prefix}_${k}`]), 0);

const F = (col, label, key, type, extra = {}) => ({ col, label, key, type, ...extra });
const auto = (col, label, key, compute, extra = {}) => F(col, label, key, 'auto', { compute, ...extra });
const sel = (col, label, key, options, extra = {}) => F(col, label, key, 'select', { options, ...extra });

// -------------------------------------------------------- section 1 .. 5, 10
// Section 1 follows the Excel sheet's own column order (A to O), left to right,
// organized into 4 logical sheet clusters: Identity, Thana, Hierarchy, Classification.
const sec1 = [
  auto('A', 'S.N.', 'sn', null, { group: 'Station identity', note: 'Serial number, assigned when the station is saved' }),
  F('B', 'Stn code', 'stn_code', 'text', { group: 'Station identity', required: true, upper: true }),
  F('C', 'Name of station', 'station_name', 'text', { group: 'Station identity', required: true }),
  sel('D', 'New stations beyond scope', 'new_beyond_scope', OPTIONS.YN, { group: 'Station identity' }),

  F('E', 'Server thana', 'server_thana', 'text', { group: 'Jurisdiction & thana' }),
  F('F', 'Server thana code', 'server_thana_code', 'text', { group: 'Jurisdiction & thana', upper: true }),
  F('G', 'Monitoring thana', 'monitoring_thana', 'text', {
    group: 'Jurisdiction & thana',
  }),
  F('H', 'Monitoring thana code', 'monitoring_thana_code', 'text', {
    group: 'Jurisdiction & thana',
    upper: true,
  }),

  sel('I', 'Z Rly', 'zone', OPTIONS.ZONE, { group: 'Railway hierarchy', required: true }),
  sel('J', 'Division', 'division', ALL_DIVISIONS, {
    group: 'Railway hierarchy',
    required: true,
    allowTyping: true,
    getDynamicOptions: (d) => (d?.zone && ZONE_DIVISIONS[d.zone] ? ZONE_DIVISIONS[d.zone] : ALL_DIVISIONS),
  }),
  sel('K', 'State', 'state', OPTIONS.STATE, { group: 'Railway hierarchy', allowTyping: true }),

  sel('L', 'Phase-I (Y/N)', 'phase1', OPTIONS.YN, { group: 'Classification & specs' }),
  sel('M', 'Old category', 'old_category', OPTIONS.OLD_CATEGORY, { group: 'Classification & specs', allowTyping: true }),
  sel('N', 'New category', 'new_category', OPTIONS.NEW_CATEGORY, { group: 'Classification & specs', allowTyping: true }),
  F('O', 'RDSO spec version', 'rdso_spec', 'text', { group: 'Classification & specs', default: 'RDSO/SPN/TC/65/2021 Version 6.0' }),
  // Values exactly as they were in the Excel sheet for columns the app recalculates (A, P, AA, AN, AO).
  // Hidden: never shown in the form, never counted in progress; kept so the sheet can be reconciled.
  F('—', 'S.N. (Excel value)', 'src_sn', 'text', { hidden: true, srcCol: 'A' }),
  F('—', 'Scope total (Excel value)', 'src_scope_total', 'text', { hidden: true, srcCol: 'P' }),
  F('—', 'Work done total (Excel value)', 'src_done_total', 'text', { hidden: true, srcCol: 'AA' }),
  F('—', 'Commissioned (Excel value)', 'src_commissioned', 'text', { hidden: true, srcCol: 'AN' }),
  F('—', 'Non-STQC total (Excel value)', 'src_p1_total', 'text', { hidden: true, srcCol: 'AO' }),
];

const sec2 = [
  auto('P', 'Total Cameras', 'scope_total', sum('scope'), { note: 'Dome + Fixed + PTZ + 4K + Yard' }),
  F('Q', 'Dome', 'scope_dome', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('R', 'Fixed', 'scope_fixed', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('S', 'PTZ', 'scope_ptz', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('T', '4K', 'scope_k4', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('U', 'Cameras to cover Yard are/in Yard', 'scope_yard', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('V', 'Nos of Panic Buttons', 'scope_panic', 'count', { group: 'Features' }),
  F('W', 'VA at Nos of Cameras', 'scope_va', 'count', {
    group: 'Features', suggest: (d) => Math.round(num(d.scope_total) * 0.2), suggestNote: '20% of total',
  }),
  F('X', 'FRS at Nos of Cameras', 'scope_frs', 'count', {
    group: 'Features', suggest: (d) => num(d.scope_k4), suggestNote: 'same as 4K',
  }),
  sel('Y', 'Cameras compliant with STQC (Yes/No)', 'scope_stqc', OPTIONS.STQC, { group: 'Features', default: 'Yes' }),
  F('Z', 'OEM of CCTV Cameras', 'scope_oem', 'text', { group: 'Features', default: 'Sparsh' }),
];

const sec3 = [
  auto('AA', 'Total Cameras', 'done_total', sum('done'), { note: 'Dome + Fixed + PTZ + 4K + Yard' }),
  F('AB', 'Dome', 'done_dome', 'count', { group: 'No of CCTV Cameras (all Types)', scopeKey: 'scope_dome', warnVsScope: true }),
  F('AC', 'Fixed', 'done_fixed', 'count', { group: 'No of CCTV Cameras (all Types)', scopeKey: 'scope_fixed', warnVsScope: true }),
  F('AD', 'PTZ', 'done_ptz', 'count', { group: 'No of CCTV Cameras (all Types)', scopeKey: 'scope_ptz', warnVsScope: true }),
  F('AE', '4K', 'done_k4', 'count', { group: 'No of CCTV Cameras (all Types)', scopeKey: 'scope_k4', warnVsScope: true }),
  F('AF', 'Cameras to cover Yard are/in Yard', 'done_yard', 'count', { group: 'No of CCTV Cameras (all Types)', scopeKey: 'scope_yard', warnVsScope: true }),
  F('AG', 'Nos of Panic Buttons', 'done_panic', 'count', { group: 'Features' }),
  F('AH', 'VA at Nos of Cameras', 'done_va', 'count', { group: 'Features' }),
  F('AI', 'FRS at Nos of Cameras', 'done_frs', 'count', { group: 'Features' }),
  sel('AJ', 'Cameras compliant with STQC', 'done_stqc', OPTIONS.STQC, { group: 'Features', default: 'Yes' }),
  F('AK', 'OEM of CCTV Cameras', 'done_oem', 'text', { group: 'Features', default: 'Sparsh' }),
  sel('AL', 'Month of Installation', 'install_month', OPTIONS.MONTH, { group: 'Installation' }),
  F('AM', 'Year Installation', 'install_year', 'year', { group: 'Installation' }),
];

// No question is asked: a station has Phase-1 cameras when any of these is filled (computed, hidden).
const P1_KEYS = ['p1_dome', 'p1_fixed', 'p1_ptz', 'p1_k4', 'p1_yard', 'p1_panic', 'p1_va', 'p1_frs'];
const hasPhase1 = (d) => P1_KEYS.some((k) => num(d[k]) > 0) || ['p1_oem', 'p1_month', 'p1_year'].some((k) => !isEmpty(d[k]) && d[k] !== NA);
const isPhase1 = (d) => d.has_phase1 === 'Y';
const sec4 = [
  auto('—', 'Has Phase-1 cameras', 'has_phase1', (d) => (hasPhase1(d) ? 'Y' : 'N'), { hidden: true }),
  auto('AO', 'Total Cameras', 'p1_total', sum('p1'), { note: 'Dome + Fixed + PTZ + 4K + Yard' }),
  F('AP', 'Dome', 'p1_dome', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('AQ', 'Fixed', 'p1_fixed', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('AR', 'PTZ', 'p1_ptz', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('AS', '4K', 'p1_k4', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('AT', 'Cameras to cover Yard are/in Yard', 'p1_yard', 'count', { group: 'No of CCTV Cameras (all Types)' }),
  F('AU', 'Nos of Panic Buttons', 'p1_panic', 'count', { group: 'Features' }),
  F('AV', 'VA at Nos of Cameras', 'p1_va', 'count', { group: 'Features' }),
  F('AW', 'FRS at Nos of Cameras', 'p1_frs', 'count', { group: 'Features' }),
  sel('AX', 'OEM of CCTV Cameras', 'p1_oem', OPTIONS.OEM_P1, { group: 'Features', allowTyping: true }),
  sel('AY', 'Month of Installation', 'p1_month', OPTIONS.MONTH, { group: 'Installation' }),
  F('AZ', 'Year Installation', 'p1_year', 'year', { group: 'Installation' }),
];

const OK_HINDRANCE = ['No Hindrance', 'Feasible', 'NA'];
const sec5 = [
  sel('BA', 'Commissioned status', 'status', OPTIONS.STATUS, { required: true }),
  auto('AN', 'Commissioned (Go live / completed i.e. with full scope)', 'commissioned', (d) => d.status ?? null, { hidden: true, note: 'Same as status; stored for export' }),
  sel('BB', 'Work done / proposed under', 'scheme', OPTIONS.SCHEME, { allowTyping: true }),
  F('BC', 'Target date to commission', 'target_commission_date', 'date', {
    visibleIf: (d) => d.status !== 'Completed' && d.status !== 'Removed',
  }),
  F('BD', 'Remarks', 'remarks', 'longtext', { full: true }),
  sel('—', 'Handed over to Railway?', 'handed_over', OPTIONS.YNNA, {
    group: 'Handover', note: 'Applicable when work is completed as per scope',
  }),
  F('BE', 'Handover date', 'handover_date', 'date', { group: 'Handover', visibleIf: (d) => d.handed_over === 'Y' }),
  F('BF', 'Target date to hand over', 'handover_target', 'date', { group: 'Handover', visibleIf: (d) => d.handed_over === 'N' }),
  sel('BG', 'Hindrance type', 'hindrance_type', OPTIONS.HINDRANCE, { group: 'Hindrance', allowTyping: true }),
  F('BH', 'Tentative date station will be available', 'hindrance_available_date', 'date', {
    group: 'Hindrance',
    visibleIf: (d) => d.status === 'Under Hindrance' || (!isEmpty(d.hindrance_type) && !OK_HINDRANCE.includes(d.hindrance_type)),
  }),
];

const sec10 = [
  sel('FB', 'Bandwidth (capacity)', 'bw_capacity', OPTIONS.BANDWIDTH, { allowTyping: true }),
  sel('FC', 'Sanctioned by Railways', 'bw_sanctioned', OPTIONS.YNNA),
  F('FD', 'Date of commissioning', 'bw_commission_date', 'date'),
];

// ---------------------------------------------- compare sections (6 .. 9)
// Item tuple: [key, label, type, options, scopeCol, actualCol, note]  ('—' = not in that block)
const DASH = '—';
const I = (key, label, type, options, scope, actual, note) => ({ key, label, type, options, scope, actual, note });

const COMPARE = {
  6: [
    { title: 'Outdoor work survey', items: [
      I('out_offered', 'Offered date', 'date', null, 'BI', 'DD'),
      I('out_status', 'Status', 'select', 'SURVEY_STATUS', 'BJ', 'DE'),
    ] },
    { title: 'Indoor work survey', items: [
      I('room', 'Room', 'select', 'ROOM', 'BK', 'DF'),
      I('power', 'Power (AT / Civil)', 'select', 'POWER', 'BL', 'DG'),
      I('ac', 'AC', 'select', 'AC_DG', 'BM', DASH),
      I('ac_single', 'Single AC', 'select', 'YNNA', DASH, 'DH', 'NA if thana is not at this station'),
      I('ac_double', 'Double AC', 'select', 'YNNA', DASH, 'DI', 'NA if thana is not at this station'),
      I('ac_none', 'No AC', 'select', 'YNNA', DASH, 'DJ', 'NA if thana is not at this station'),
      I('ac_tonnage', 'AC tonnage', 'text', null, DASH, 'DK', 'e.g. 1x1.5 or 1x2'),
      I('dg', 'DG', 'select', 'AC_DG', 'BN', 'DL'),
    ] },
  ],
  7: [
    { title: 'Switch', items: [
      I('sw_t1', 'Type-I', 'count', null, 'BO', 'DM'),
      I('sw_t2', 'Type-II', 'count', null, 'BP', 'DN'),
      I('sw_t3', 'Type-III', 'count', null, 'BQ', 'DO'),
      I('sw_t4', 'Type-IV', 'count', null, 'BR', 'DP'),
      I('sw_erps', 'Type-IV ERPS working', 'select', 'YNNA', 'BS', 'DQ'),
    ] },
    { title: 'Server', items: [
      I('srv_vms', 'VMS', 'count', null, 'BT', 'DR'),
      I('srv_va', 'VA', 'count', null, 'BU', 'DS'),
      I('srv_frs', 'FRS', 'count', null, 'BV', 'DT'),
      I('srv_lfd', 'LFD', 'count', null, 'BW', 'DU'),
      I('srv_ws', 'Workstations', 'count', null, 'BX', 'DV'),
    ] },
  ],
  8: [
    { title: 'UPS & batteries', items: [
      I('ups_2x10', 'UPS 2×10 KVA (indoor/outdoor)', 'count', null, 'BY', 'DW'),
      I('ups_2x10_batt', 'UPS batteries', 'select', 'BATTERY', 'BZ', 'DX'),
      I('ups_1k', '1 KVA UPS', 'count', null, 'CA', 'DY'),
      I('ups_1k_batt', '1 KVA batteries', 'count', null, 'CB', 'DZ'),
      I('ups_2k', '2 KVA UPS', 'count', null, 'CC', 'EA'),
      I('ups_2k_batt', '2 KVA batteries', 'count', null, 'CD', 'EB'),
    ] },
    { title: 'Racks & network', items: [
      I('rack_42u', '42U rack', 'count', null, 'CE', 'EC'),
      I('rack_9u', '9U rack', 'count', null, 'CF', 'ED'),
      I('rack_6u', '6U rack', 'count', null, 'CG', 'EE'),
      I('media_conv', 'Media converter', 'count', null, 'CH', 'EF'),
      I('joystick', 'Joystick', 'count', null, 'CL', 'EJ'),
      I('fms_12f', '12F FMS', 'count', null, 'CM', 'EK'),
      I('fms_24f', '24F FMS', 'count', null, 'CN', 'EL'),
      I('earthing', 'Earthing', 'count', null, 'CO', 'EM'),
      I('acdb', 'ACDB', 'count', null, 'CQ', 'EO'),
    ] },
    { title: 'Cables & pipes (metres)', items: [
      I('cbl_power', 'Power cable', 'metres', null, 'CI', 'EG'),
      I('cbl_cat6', 'CAT6 cable', 'metres', null, 'CJ', 'EH'),
      I('cbl_ofc12', '12F OFC cable', 'metres', null, 'CK', 'EI'),
      I('pipe_gi', 'GI pipe', 'metres', null, 'CP', 'EN'),
      I('pipe_pvc', 'PVC flexible', 'metres', null, 'CR', 'EP'),
      I('pipe_hdpe', 'HDPE pipe', 'metres', null, 'CS', 'EQ'),
    ] },
  ],
  9: [
    { title: 'Software & integration', items: [
      I('gui', 'GUI', 'select', 'YNNA', 'CT', 'ER'),
      I('storage', 'Storage', 'text', null, 'CU', 'ES', 'e.g. 30 days'),
      I('nomenclature', 'Camera nomenclature as per RB letter', 'select', 'YNNA', 'CV', 'ET'),
      I('ems', 'EMS integration', 'select', 'INTEGRATION', 'CW', 'EU'),
      I('iccc', 'ICCC integration', 'select', 'INTEGRATION', 'CX', 'EV'),
      I('war_room', 'War room (CMS)', 'select', 'INTEGRATION', 'CY', 'EW'),
    ] },
    { title: 'Execution & documentation', items: [
      I('blowing', 'Blowing / pulling (metres)', 'metres', null, 'CZ', 'EX'),
      I('training', 'Training', 'select', 'TRAINING', 'DA', 'EY'),
      I('survey_drawing', 'Survey drawing', 'select', 'DRAWING', 'DB', 'EZ'),
      I('abd', 'ABD', 'select', 'ABD', 'DC', 'FA'),
    ] },
  ],
};

function buildCompare(n) {
  const fields = [];
  const blocks = COMPARE[n].map((b) => ({
    title: b.title,
    items: b.items.map((it) => {
      const make = (side, col) => {
        if (col === DASH) return null;
        const prefix = side === 'scope' ? 'sc_' : 'ac_';
        const def = F(col, `${it.label} (${side === 'scope' ? 'Scope' : 'Actual'})`, prefix + it.key, it.type, {
          group: b.title, side, note: it.note,
          ...(it.options ? { options: OPTIONS[it.options] } : {}),
        });
        fields.push(def);
        return def;
      };
      return { key: it.key, label: it.label, note: it.note, scope: make('scope', it.scope), actual: make('actual', it.actual) };
    }),
  }));
  return { fields, blocks };
}

// ----------------------------------------------------------------- sections
const META = [
  { id: 'station', title: 'Station details', subtitle: 'Identity, thana, zone & category', cols: 'Cols A–O', fields: sec1 },
  { id: 'scope', title: 'Scope of work', subtitle: 'As per approved survey', cols: 'Cols P–Z', fields: sec2 },
  { id: 'done', title: 'Work done', subtitle: 'Installed cameras & features', cols: 'Cols AA–AM', fields: sec3 },
  {
    id: 'phase1', title: 'Existing non-STQC cameras', subtitle: 'Phase-1 legacy installation', cols: 'Cols AO–AZ', fields: sec4,
    // Not applicable (shown as N/A, left out of the % filled) unless the station has Phase-1 cameras.
    applicable: isPhase1,
  },
  { id: 'commission', title: 'Commissioning & handover', subtitle: 'Go-live status, handover, hindrance', cols: 'Cols AN, BA–BH', fields: sec5 },
  { id: 'survey', title: 'Site survey', subtitle: 'Outdoor & indoor survey', cols: 'Cols BI–BN / DD–DL', compare: 6 },
  { id: 'active', title: 'Active components', subtitle: 'Switches & server', cols: 'Cols BO–BX / DM–DV', compare: 7 },
  { id: 'passive', title: 'Passive components', subtitle: 'Power, racks, cabling & civil', cols: 'Cols BY–CS / DW–EQ', compare: 8 },
  { id: 'other', title: 'Other items', subtitle: 'Software, integration, documentation', cols: 'Cols CT–DC / ER–FA', compare: 9 },
  { id: 'bandwidth', title: 'Bandwidth', subtitle: 'Link capacity & sanction', cols: 'Cols FB–FD', fields: sec10 },
];

export const SECTIONS = META.map((m, i) => {
  const s = { number: i + 1, id: m.id, title: m.title, subtitle: m.subtitle, cols: m.cols, applicable: m.applicable };
  if (m.compare) {
    const { fields, blocks } = buildCompare(m.compare);
    return { ...s, kind: 'compare', blocks, fields: fields.map((f) => ({ ...f, section: m.id })) };
  }
  return { ...s, kind: 'fields', fields: m.fields.map((f) => ({ ...f, section: m.id })) };
});

// The compare blocks hold references to the un-stamped field objects; re-point
// them at the stamped copies so there is exactly one object per field.
SECTIONS.filter((s) => s.kind === 'compare').forEach((s) => {
  const byKey = Object.fromEntries(s.fields.map((f) => [f.key, f]));
  s.blocks.forEach((b) => b.items.forEach((it) => {
    it.scope = it.scope ? byKey[it.scope.key] : null;
    it.actual = it.actual ? byKey[it.actual.key] : null;
  }));
});

export const FIELDS = SECTIONS.flatMap((s) => s.fields);
export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
export const KNOWN_KEYS = new Set(FIELDS.map((f) => f.key));

// --------------------------------------------------------- data functions
export const defaultsFor = () => Object.fromEntries(FIELDS.filter((f) => f.default !== undefined).map((f) => [f.key, f.default]));

/** Keep only known keys; '' becomes null. */
export function pickKnown(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data)) if (KNOWN_KEYS.has(k)) out[k] = v === '' ? null : v;
  return out;
}

/** Returns a new object with every auto field recomputed and uppercase rules applied. */
export function applyComputed(data) {
  const d = { ...data };
  for (const f of FIELDS) {
    if (f.upper && typeof d[f.key] === 'string') d[f.key] = d[f.key].toUpperCase();
  }
  // Thana auto-sync: In Excel, Monitoring Thana (=E) and Monitoring Thana code (=F)
  // mirror Server thana by default unless explicitly customized.
  if (isEmpty(d.monitoring_thana) && !isEmpty(d.server_thana)) {
    d.monitoring_thana = d.server_thana;
  }
  if (isEmpty(d.monitoring_thana_code) && !isEmpty(d.server_thana_code)) {
    d.monitoring_thana_code = d.server_thana_code;
  }
  for (const f of FIELDS) if (f.compute) d[f.key] = f.compute(d);
  return d;
}

export function isVisible(field, data) {
  if (field.hidden) return false;
  return field.visibleIf ? !!field.visibleIf(data) : true;
}

const toNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const validDate = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Returns { errors: {key: msg}, warnings: {key: msg} } for visible fields only. */
export function validate(rawData, { strict = false } = {}) {
  const data = applyComputed(rawData);
  const errors = {};
  const warnings = {};
  // Business rules: blocking errors when a station is created / a draft is finalised (strict),
  // otherwise advisory warnings, so existing imported records can still be edited.
  const rule = (key, msg) => { if (!errors[key]) (strict ? errors : warnings)[key] = msg; };
  const old = (v) => `Old value: ${v}`;

  for (const f of FIELDS) {
    if (f.type === 'auto' || !isVisible(f, data)) continue;
    const v = data[f.key];
    if (isEmpty(v)) {
      if (f.required) errors[f.key] = 'Required';
      continue;
    }
    if (f.type === 'count' || f.type === 'metres') {
      if (v === NA) continue;
      const n = toNum(v);
      if (n === null) warnings[f.key] = old(v);
      else if (n < 0) errors[f.key] = 'Cannot be negative';
      else if (f.type === 'count' && !Number.isInteger(n)) errors[f.key] = 'Must be a whole number';
    } else if (f.type === 'date') {
      if (v !== NA && !(typeof v === 'string' && validDate(v))) warnings[f.key] = old(v);
    } else if (f.type === 'year') {
      const n = toNum(v);
      if (n === null || !Number.isInteger(n) || n < 2000 || n > 2100) warnings[f.key] = old(v);
    } else if (f.type === 'select' && !f.allowTyping) {
      if (!f.options.includes(v)) warnings[f.key] = old(v);
    }
  }

  if (strict && isEmpty(data.state)) errors.state = 'Required';
  if ((data.status === 'Completed' || data.status === 'Go Live')) {
    if (isEmpty(data.install_month)) rule('install_month', 'Required when commissioned');
    if (isEmpty(data.install_year)) rule('install_year', 'Required when commissioned');
  }
  if (data.handed_over === 'Y' && isEmpty(data.handover_date)) rule('handover_date', 'Required when handed over');
  if (data.handed_over === 'N' && isEmpty(data.handover_target)) rule('handover_target', 'Enter the target date to hand over');
  if ((data.status === 'Under Hindrance' || hasHindrance(data)) && isEmpty(data.remarks) && isEmpty(data.hindrance_available_date)) {
    rule('remarks', 'A hindrance needs remarks or the date the station will be available');
  }
  for (const f of FIELDS) {
    if (!f.warnVsScope || !isVisible(f, data) || errors[f.key]) continue;
    const done = toNum(data[f.key]);
    const scopeVal = toNum(data[f.scopeKey]);
    if (done !== null && scopeVal !== null && done > scopeVal && !warnings[f.key]) {
      warnings[f.key] = `Exceeds scope (${scopeVal})`;
    }
  }
  if (data.status === 'Completed' && num(data.done_total) < num(data.scope_total) && !warnings.status) {
    warnings.status = `Marked Completed but only ${num(data.done_total)} of ${num(data.scope_total)} cameras done`;
  }
  return { errors, warnings };
}

/** Fields that count towards progress: visible and user-editable. */
export const progressFields = (section, data) => section.fields.filter((f) => f.type !== 'auto' && isVisible(f, data));

export const isApplicable = (section, data) => !section.applicable || !!section.applicable(data);

/** { filled, total } for a section, or { na: true } when the section does not apply to this station. */
export function sectionProgress(section, data) {
  if (!isApplicable(section, data)) return { filled: 0, total: 0, na: true };
  const fields = progressFields(section, data);
  const filled = fields.filter((f) => !isEmpty(data[f.key])).length;
  return { filled, total: fields.length };
}

export function overallProgress(data) {
  let filled = 0;
  let total = 0;
  for (const s of SECTIONS) {
    const p = sectionProgress(s, data);
    if (p.na) continue;
    filled += p.filled;
    total += p.total;
  }
  return { filled, total, pct: total ? Math.round((filled / total) * 100) : 0 };
}

// ------------------------------------------------------------ application lifecycle
// A controlled status owned by the application. It never overwrites the sheet's own status fields
// (status = col BA, out_status = BJ ...); those stay exactly as entered.
export const LIFECYCLE = [
  'New', 'Survey Pending', 'Survey Completed', 'Work In Progress', 'Offered', 'Commissioned',
  'Handover Pending', 'Handed Over', 'On Hold / Hindrance', 'Closed',
];

const OK_SURVEY = ['approved', 'done', 'completed'];
// The sheet's hindrance column holds free text ("No Hindrances", "Feasible", "Thana under ABSS", "Flag station"...).
const BLOCKING = /abss|renovat|ofc|flag|drop|remov|gauge|halt|not available/i;
const hasHindrance = (d) => !isEmpty(d.hindrance_type) && !/^no hindrance/i.test(String(d.hindrance_type)) && BLOCKING.test(String(d.hindrance_type));

/**
 * Starting lifecycle for a station, derived from its sheet values (used when importing / when none is set).
 * Rule: Removed -> Closed; Under Hindrance or a blocking hindrance type -> On Hold; Completed/Go Live ->
 * Handed Over / Handover Pending / Commissioned by the handover answer; Not Live -> by work and survey progress.
 */
export function deriveLifecycle(d) {
  const status = d.status;
  if (typeof status === 'string' && status.toLowerCase().startsWith('removed')) return 'Closed';
  if (status === 'Under Hindrance' || hasHindrance(d)) return 'On Hold / Hindrance';
  if (status === 'Completed' || status === 'Go Live') {
    // The sheet records handover as a date (col BE); a real date means it was handed over.
    if (d.handed_over === 'Y' || /^\d{4}-\d{2}-\d{2}$/.test(String(d.handover_date ?? ''))) return 'Handed Over';
    if (d.handed_over === 'N' || !isEmpty(d.handover_target)) return 'Handover Pending';
    return 'Commissioned';
  }
  if (num(d.done_total) > 0) return 'Work In Progress';
  if (!isEmpty(d.sc_out_offered) || !isEmpty(d.ac_out_offered)) return 'Offered';
  if (OK_SURVEY.includes(String(d.sc_out_status ?? d.ac_out_status ?? '').toLowerCase())) return 'Survey Completed';
  return status ? 'Survey Pending' : 'New';
}

/** Which section a field key belongs to (used to jump to the first error). */
export const sectionOf = (key) => FIELD_BY_KEY[key]?.section;

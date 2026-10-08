/**
 * The layout of the Excel sheet "Commissioned stations NR", used by the CSV export so the file looks like the sheet:
 *   row 1 blank, row 2 the sheet title, rows 3-5 the three header rows (group headings, sub-groups, column names),
 *   data from row 6, 160 columns A..FD in the sheet's own order and wording (typos included).
 * A CSV cannot merge cells, so a heading that the sheet merges across several columns is written once, in the first
 * column it covers, and left blank over the others.
 */
export const EXPORT_TITLE = 'Status of CCTV System at Railway Stations (existing and ongoing/Planned works)';
export const EXPORT_COLUMN_COUNT = 160;

export const colName = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
export const colNum = (c) => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

const cols = Array.from({ length: EXPORT_COLUMN_COUNT }, (_, i) => ({ col: colName(i + 1), h3: '', h4: '', h5: '' }));
const put = (row, start, texts) => texts.forEach((t, i) => { cols[colNum(start) - 1 + i][row] = t; });

// A..O: one heading each (merged over header rows 3-5 in the sheet)
put('h3', 'A', ['S.N.', 'Stn CODE', 'NAME OF STATION', 'New stations beyond scope', 'Server thana', 'Server thana code', 'Monitoring Thana',
  'Monitoring Thana code', 'Z RLY', 'DIVISION', 'STATE', 'Phase-I (Y/N)', 'OLD CATEGORY', 'NEW CATEGORY', 'RDSO spec ver']);

const CAMERA_LEAVES = ['Total Cameras', 'Dome', 'Fixed', 'PTZ', '4K', 'Cameras to cover Yard are/in'];

// P..Z: Scope of Work as per approved survey
put('h3', 'P', ['Scope of Work as per approved survey']);
put('h4', 'P', ['No of CCTV Cameras (all Types)']);
put('h5', 'P', CAMERA_LEAVES);
put('h4', 'V', ['Nos of Panic Buttons', 'VA at Nos of Cameras', 'FRS at Nos of Cameras', 'Cameras compliant with STQC (Yes/No)', 'OEM of CCTV Cameras']);

// AA..AN: Work done
put('h3', 'AA', ['Work done']);
put('h4', 'AA', ['No of CCTV Cameras (all Types)']);
put('h5', 'AA', CAMERA_LEAVES);
put('h4', 'AG', ['Nos of Panic Buttons', 'VA at Nos of Cameras', 'FRS at Nos of Cameras', 'Cameras compliant with STQC', 'OEM of CCTV Cameras']);
put('h3', 'AL', ['Month of Installation', 'Year Installation', 'Commissioned (Go live/ completed i.e. with full scope)']);

// AO..AZ: Non STQC camera (Phase-1)
put('h3', 'AO', ['Non STQC camera (Phase-1)']);
put('h5', 'AO', [...CAMERA_LEAVES, 'Nos of Panic Buttons', 'VA at Nos of Cameras', 'FRS at Nos of Cameras', 'OEM of CCTV Cameras',
  'Month of Installation', 'Year Installation']);

// BA..BH: commissioning, handover, hindrance
put('h3', 'BA', ['Commissioned (Go live/ completed i.e. with full scope)', 'under which work done/Proposed', 'Target date to Commission', 'Remarks if any']);
put('h5', 'BB', ['Nirbhaya-RailTel/VSS-RailTel-D&E Ctg stns']);
put('h3', 'BE', ['handover to Railway (Y/N) ( applicable when work completed as per Scope)']);
put('h5', 'BE', ['hadover date', 'handed over, then taregt to']);
put('h3', 'BG', ['Hindrance type (ABSS/ Renovation/ OFC not avaialble/ station drop/ remove from list/others)', 'tentative date for when station will available']);

// The two survey blocks (BI..DC and DD..FA) share their wording; the indoor part differs in the AC columns.
const SW = ['Type-I', 'Type-II', 'Type-III', 'Type-IV', 'ERPS working (Y/N)'];
const SERVER = ['VMS', 'VA', 'FRS', 'LFD', 'WorkStations'];
const UPS = ['(indoor/ outdoor)', 'batteries (replaced/New)'];
const PASSIVE = (racks) => ['1KVA', 'Batteries', '2KVA', 'Batteries', '42 U rack', '9U rack', racks, 'Media converter', 'Power cable', 'cat 6 cable',
  '12 OFC cable', 'Joy stick', '12 F FMS', '24F FMS', 'Eathing', 'GI Pipe', 'ACDB', 'PVC flexible', 'HDPE pipe'];
const OTHER = ['GUI', 'Storage', 'Camera nomenclature as per RB letter', 'EMS integration', 'ICCC integration', 'War room (CMS)', 'blowing, pulling',
  'Training', 'Survey drawing', 'ABD'];

// Block 1: BI..DC
put('h3', 'BI', ['Survey for outdoor work']); put('h5', 'BI', ['offered date', 'Status']);
put('h3', 'BK', ['Survey for indoor work']); put('h5', 'BK', ['Room', 'Power(AT/Civil)', 'AC', 'DG']);
put('h3', 'BO', ['Active Component']); put('h4', 'BO', ['Switch']); put('h5', 'BO', SW);
put('h4', 'BT', ['Server']); put('h5', 'BT', SERVER);
put('h3', 'BY', ['Passive component']); put('h5', 'BY', [...UPS, ...PASSIVE('6 U rack')]);
put('h3', 'CT', ['Other Items']); put('h5', 'CT', OTHER);

// Block 2: DD..FA
put('h3', 'DD', ['Survey for outdoor work']); put('h5', 'DD', ['offered date', 'Status']);
put('h3', 'DF', ['Survey for indoor work']);
put('h5', 'DF', ['Room', 'Power(AT/Civil)', 'AC (Single AC)', 'double AC', 'NO AC', 'tonnage of AC', 'DG']);
put('h3', 'DM', ['Active Component']); put('h4', 'DM', ['Switch']); put('h5', 'DM', SW);
put('h4', 'DR', ['Server']); put('h5', 'DR', SERVER);
put('h3', 'DW', ['Passive component']); put('h5', 'DW', [...UPS, ...PASSIVE('6 U racks')]);
put('h3', 'ER', ['Other Items']); put('h5', 'ER', OTHER);

// FB..FD: Bandwidth
put('h3', 'FB', ['Bandwidth Details']);
put('h5', 'FB', ['Bandwidth (capacity)', 'Sanction by Railways', 'Date of Commissioning']);

export const EXPORT_COLUMNS = cols;

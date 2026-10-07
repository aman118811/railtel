/**
 * Indian Railways Master Station Directory for CCTV VSS Project.
 * Contains station code mappings with Name, Zone, Division, State, and Thana.
 * When a user enters or searches a station code, these details can be auto-populated in 1 click.
 */
export const STATIONS_MASTER = [
  // FZR Division (Northern Railway)
  { code: 'CKDL', name: 'Chak Dyala', zone: 'NR', division: 'FZR', state: 'Jammu & Kashmir', thana: 'Kathua', thanaCode: 'KTHU', cat: 'E' },
  { code: 'RRW', name: 'Roranwali', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Kotkapura', thanaCode: 'KKP', cat: 'E' },
  { code: 'GKX', name: 'Ghal Kalan', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Ludhiana', thanaCode: 'LDH', cat: 'E' },
  { code: 'MG', name: 'Model Gram', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Ludhiana', thanaCode: 'LDH', cat: 'E' },
  { code: 'NNKR', name: 'Nanaksar', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Ludhiana', thanaCode: 'LDH', cat: 'E' },
  { code: 'BRMR', name: 'Bharmar', zone: 'NR', division: 'FZR', state: 'Himachal Pradesh', thana: 'Pathankot', thanaCode: 'PTK', cat: 'E' },
  { code: 'GSB', name: 'Garna Sahib', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Pathankot', thanaCode: 'PTK', cat: 'E' },
  { code: 'PMQ', name: 'Parmanand', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Pathankot', thanaCode: 'PTK', cat: 'E' },
  { code: 'SOHL', name: 'Sohal', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Pathankot', thanaCode: 'PTK', cat: 'E' },
  { code: 'BLND', name: 'Bolina Doaba', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Phagwara', thanaCode: 'PGW', cat: 'E' },
  { code: 'FZR', name: 'Firozpur Cantt', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Firozpur', thanaCode: 'FZR', cat: 'A' },
  { code: 'JUC', name: 'Jalandhar City', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Jalandhar', thanaCode: 'JUC', cat: 'A-1' },
  { code: 'ASR', name: 'Amritsar Jn', zone: 'NR', division: 'FZR', state: 'Punjab', thana: 'Amritsar', thanaCode: 'ASR', cat: 'A-1' },
  { code: 'JAT', name: 'Jammu Tawi', zone: 'NR', division: 'FZR', state: 'Jammu & Kashmir', thana: 'Jammu Tawi', thanaCode: 'JAT', cat: 'A-1' },

  // UMB Division (Northern Railway)
  { code: 'NNGL', name: 'Naya Nangal (Halt)', zone: 'NR', division: 'UMB', state: 'Punjab', thana: 'Nangal Dam', thanaCode: 'NLDM', cat: 'E' },
  { code: 'FGSB', name: 'Fateh Garh Sahib', zone: 'NR', division: 'UMB', state: 'Punjab', thana: 'Sirhind Jn.', thanaCode: 'SIR', cat: 'E' },
  { code: 'UMB', name: 'Ambala Cantt', zone: 'NR', division: 'UMB', state: 'Haryana', thana: 'Ambala Cantt', thanaCode: 'UMB', cat: 'A-1' },
  { code: 'CDG', name: 'Chandigarh', zone: 'NR', division: 'UMB', state: 'Chandigarh', thana: 'Chandigarh', thanaCode: 'CDG', cat: 'A-1' },
  { code: 'KLK', name: 'Kalka', zone: 'NR', division: 'UMB', state: 'Haryana', thana: 'Kalka', thanaCode: 'KLK', cat: 'A' },
  { code: 'SRE', name: 'Saharanpur Jn', zone: 'NR', division: 'UMB', state: 'Uttar Pradesh', thana: 'Saharanpur', thanaCode: 'SRE', cat: 'A' },

  // DLI Division (Northern Railway)
  { code: 'SWDE', name: 'SEWAHA', zone: 'NR', division: 'DLI', state: 'Haryana', thana: 'Panipat', thanaCode: 'PNP', cat: 'E' },
  { code: 'NDLS', name: 'New Delhi', zone: 'NR', division: 'DLI', state: 'Delhi', thana: 'New Delhi', thanaCode: 'NDLS', cat: 'A-1' },
  { code: 'DLI', name: 'Old Delhi Jn', zone: 'NR', division: 'DLI', state: 'Delhi', thana: 'Delhi Jn', thanaCode: 'DLI', cat: 'A-1' },
  { code: 'NZM', name: 'Hazrat Nizamuddin', zone: 'NR', division: 'DLI', state: 'Delhi', thana: 'Hazrat Nizamuddin', thanaCode: 'NZM', cat: 'A-1' },
  { code: 'ANVT', name: 'Anand Vihar Terminal', zone: 'NR', division: 'DLI', state: 'Delhi', thana: 'Anand Vihar', thanaCode: 'ANVT', cat: 'A-1' },
  { code: 'GZB', name: 'Ghaziabad Jn', zone: 'NR', division: 'DLI', state: 'Uttar Pradesh', thana: 'Ghaziabad', thanaCode: 'GZB', cat: 'A' },
  { code: 'PNP', name: 'Panipat Jn', zone: 'NR', division: 'DLI', state: 'Haryana', thana: 'Panipat', thanaCode: 'PNP', cat: 'A' },
  { code: 'KUN', name: 'Karnal', zone: 'NR', division: 'DLI', state: 'Haryana', thana: 'Karnal', thanaCode: 'KUN', cat: 'A' },

  // MB Division (Northern Railway)
  { code: 'SNX', name: 'Saneh Road', zone: 'NR', division: 'MB', state: 'Uttarakhand', thana: 'Nazibabad', thanaCode: 'NBD', cat: 'E' },
  { code: 'CHTI', name: 'Chanethi', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Chandausi', thanaCode: 'CH', cat: 'E' },
  { code: 'CBJ', name: 'Clutterbuckganj', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Chandausi', thanaCode: 'CH', cat: 'E' },
  { code: 'PMR', name: 'Pitambarpur', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Chandausi', thanaCode: 'CH', cat: 'E' },
  { code: 'KGF', name: 'Katghar', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Rampur', thanaCode: 'RMU', cat: 'E' },
  { code: 'MB', name: 'Moradabad Jn', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Moradabad', thanaCode: 'MB', cat: 'A-1' },
  { code: 'BE', name: 'Bareilly Jn', zone: 'NR', division: 'MB', state: 'Uttar Pradesh', thana: 'Bareilly', thanaCode: 'BE', cat: 'A-1' },
  { code: 'HW', name: 'Haridwar Jn', zone: 'NR', division: 'MB', state: 'Uttarakhand', thana: 'Haridwar', thanaCode: 'HW', cat: 'A-1' },
  { code: 'DDN', name: 'Dehradun', zone: 'NR', division: 'MB', state: 'Uttarakhand', thana: 'Dehradun', thanaCode: 'DDN', cat: 'A-1' },

  // LKO Division (Northern Railway)
  { code: 'LKO', name: 'Lucknow Charbagh', zone: 'NR', division: 'LKO', state: 'Uttar Pradesh', thana: 'Lucknow', thanaCode: 'LKO', cat: 'A-1' },
  { code: 'BSB', name: 'Varanasi Cantt', zone: 'NR', division: 'LKO', state: 'Uttar Pradesh', thana: 'Varanasi', thanaCode: 'BSB', cat: 'A-1' },
  { code: 'SLN', name: 'Sultanpur Jn', zone: 'NR', division: 'LKO', state: 'Uttar Pradesh', thana: 'Sultanpur', thanaCode: 'SLN', cat: 'A' },
  { code: 'AY', name: 'Ayodhya Jn', zone: 'NR', division: 'LKO', state: 'Uttar Pradesh', thana: 'Ayodhya', thanaCode: 'AY', cat: 'A' },

  // NCR (North Central Railway)
  { code: 'PCOI', name: 'Prayagraj Chheoki', zone: 'NCR', division: 'ALD', state: 'Uttar Pradesh', thana: 'Chheoki', thanaCode: 'COI', cat: 'E' },
  { code: 'NYN', name: 'Naini Jn', zone: 'NCR', division: 'ALD', state: 'Uttar Pradesh', thana: 'Naini', thanaCode: 'NYN', cat: 'D' },
  { code: 'SFG', name: 'Subedarganj', zone: 'NCR', division: 'ALD', state: 'Uttar Pradesh', thana: 'Subedar Ganj', thanaCode: 'SFG', cat: 'E' },
  { code: 'PRYJ', name: 'Prayagraj Jn', zone: 'NCR', division: 'ALD', state: 'Uttar Pradesh', thana: 'Prayagraj', thanaCode: 'PRYJ', cat: 'A-1' },
  { code: 'CNB', name: 'Kanpur Central', zone: 'NCR', division: 'ALD', state: 'Uttar Pradesh', thana: 'Kanpur', thanaCode: 'CNB', cat: 'A-1' },
  { code: 'BNDA', name: 'Banda', zone: 'NCR', division: 'JHS', state: 'Uttar Pradesh', thana: 'Banda', thanaCode: 'BNDA', cat: 'D' },
  { code: 'BUS', name: 'Badausa', zone: 'NCR', division: 'JHS', state: 'Uttar Pradesh', thana: 'Banda', thanaCode: 'BNDA', cat: 'E' },
  { code: 'KHQ', name: 'Khurhand', zone: 'NCR', division: 'JHS', state: 'Uttar Pradesh', thana: 'Banda', thanaCode: 'BNDA', cat: 'E' },
  { code: 'GWL', name: 'Gwalior Jn', zone: 'NCR', division: 'JHS', state: 'Madhya Pradesh', thana: 'Gwalior', thanaCode: 'GWL', cat: 'A-1' },
  { code: 'JHS', name: 'Virangana Lakshmibai Jhansi', zone: 'NCR', division: 'JHS', state: 'Uttar Pradesh', thana: 'Jhansi', thanaCode: 'JHS', cat: 'A-1' },

  // NER (North Eastern Railway)
  { code: 'ALY', name: 'Prayagraj Rambag (Allahabad City)', zone: 'NER', division: 'Varanasi', state: 'Uttar Pradesh', thana: 'Allahabad City', thanaCode: 'ALY', cat: 'D' },
  { code: 'GYN', name: 'Gyanpur Road', zone: 'NER', division: 'Varanasi', state: 'Uttar Pradesh', thana: 'Allahabad City', thanaCode: 'ALY', cat: 'D' },
  { code: 'MBS', name: 'Madhosingh', zone: 'NER', division: 'Varanasi', state: 'Uttar Pradesh', thana: 'Manduadih', thanaCode: 'MUV/BSBS', cat: 'E' },
  { code: 'TPU', name: 'Tanakpur', zone: 'NER', division: 'Izzatnagar', state: 'Uttarakhand', thana: 'Pilibhit Jn.', thanaCode: 'PBE', cat: 'D' },
  { code: 'GKP', name: 'Gorakhpur Jn', zone: 'NER', division: 'Lucknow', state: 'Uttar Pradesh', thana: 'Gorakhpur', thanaCode: 'GKP', cat: 'A-1' },

  // NWR (North Western Railway)
  { code: 'JW', name: 'Jatwara', zone: 'NWR', division: 'Jaipur', state: 'Rajasthan', thana: 'Dausa', thanaCode: 'DO', cat: 'E' },
  { code: 'JHIR', name: 'Jhir', zone: 'NWR', division: 'Jaipur', state: 'Rajasthan', thana: 'Dausa', thanaCode: 'DO', cat: 'E' },
  { code: 'BAI', name: 'Bassi', zone: 'NWR', division: 'Jaipur', state: 'Rajasthan', thana: 'Dausa', thanaCode: 'DO', cat: 'E' },
  { code: 'KUT', name: 'Kanota', zone: 'NWR', division: 'Jaipur', state: 'Rajasthan', thana: 'Dausa', thanaCode: 'DO', cat: 'E' },
  { code: 'JP', name: 'Jaipur Jn', zone: 'NWR', division: 'Jaipur', state: 'Rajasthan', thana: 'Jaipur', thanaCode: 'JP', cat: 'A-1' },
];

export const MASTER_BY_CODE = Object.fromEntries(STATIONS_MASTER.map((s) => [s.code.toUpperCase(), s]));

/** Look up station by code (case-insensitive) */
export function lookupStation(code) {
  if (!code) return null;
  return MASTER_BY_CODE[code.trim().toUpperCase()] || null;
}

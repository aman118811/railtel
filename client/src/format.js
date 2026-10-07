/** sessionStorage key where a list page remembers its address (so a form's Back returns to the same filters). */
export const LIST_QUERY_KEY = 'cctv.listPath';

export const rememberList = (path) => {
  try { sessionStorage.setItem(LIST_QUERY_KEY, path); } catch { /* storage unavailable */ }
};

export function lastListPath() {
  try { return sessionStorage.getItem(LIST_QUERY_KEY) || '/stations'; } catch { return '/stations'; }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(v) {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}` : String(v);
}

export function fmtDateTime(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const toN = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
export { toN };

/**
 * Approved vs Work Done for one component. Never changes the stored values.
 * flag: complete | shortfall | over | pending | none
 */
export function compareQty(scope, done, commissioned = false) {
  const s = toN(scope);
  const d = toN(done);
  if (s === null && d === null) return { s, d, variance: null, pct: null, flag: 'none' };
  const variance = (d ?? 0) - (s ?? 0);
  const pct = s ? Math.min(100, Math.round(((d ?? 0) / s) * 100)) : null;
  let flag = 'pending';
  if (variance > 0) flag = 'over';
  else if (variance === 0) flag = 'complete';
  else if (commissioned) flag = 'shortfall';
  return { s, d, variance, pct, flag };
}

export const FLAG_LABEL = { complete: 'Completed', shortfall: 'Shortfall', over: 'Over scope', pending: 'Pending', none: '—' };
export const isCommissioned = (status) => status === 'Completed' || status === 'Go Live';

// The one place the UI talks to its data: the Express API (which stores everything in MongoDB).
// The browser never connects to the database. In development Vite forwards /api to http://localhost:4000;
// when deployed, /api is served from the same site. Set VITE_API_URL only if the API lives on another origin.

const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

class ApiError extends Error {
  constructor(status, body) {
    // A 5xx with no JSON error text usually means the API is down behind a proxy/gateway.
    super(body?.error || (status >= 500
      ? 'The server is not responding. Check that the API is running.'
      : `Request failed (${status})`));
    this.status = status;
    this.body = body || {};
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: 'Cannot reach the server. Check your connection and that the API is running.' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

// The selected region (ER / NR / SR / WR) is a per-viewer convenience, kept in the browser and sent with every request.
const REGION_KEY = 'cctv.region';
export const getRegion = () => { try { return localStorage.getItem(REGION_KEY) || 'NR'; } catch { return 'NR'; } };
export const setRegion = (r) => { try { localStorage.setItem(REGION_KEY, r); } catch { /* storage unavailable */ } };

const query = (params) => new URLSearchParams(Object.entries({ region: getRegion(), ...params }).filter(([, v]) => v)).toString();

export const api = {
  list: (params = {}) => request('GET', `/stations?${query(params)}`),
  all: () => request('GET', `/stations?${query({ full: 1 })}`),
  get: (id) => request('GET', `/stations/${id}`),
  // Paged, sorted, filtered list: { items, total, page, pageSize, pages }
  page: (params = {}) => request('GET', `/stations?${query({ ...params, page: params.page || 1 })}`),
  dashboard: () => request('GET', `/dashboard?${query({})}`),
  facets: () => request('GET', `/facets?${query({})}`),
  lookups: (region) => request('GET', `/lookups?${query(region ? { region } : {})}`),
  exportUrl: (params = {}) => `${BASE}/export?${query(params)}`,
  // extra: { draft, lifecycle }
  create: (data, user, extra = {}) => request('POST', '/stations', { data, user, region: getRegion(), ...extra }),
  update: (id, data, user, updated_at, extra = {}) => request('PUT', `/stations/${id}`, { data, user, updated_at, ...extra }),
  history: (id) => request('GET', `/stations/${id}/history`),
  // projects
  projects: (params = {}) => request('GET', `/projects?${query(params)}`),
  project: (id) => request('GET', `/projects/${id}`),
  createProject: (data, user) => request('POST', '/projects', { data, user, region: getRegion() }),
  updateProject: (id, data, user, updated_at) => request('PUT', `/projects/${id}`, { data, user, updated_at }),
  projectHistory: (id) => request('GET', `/projects/${id}/history`),
  linkStation: (projectId, stationId, user) => request('POST', `/projects/${projectId}/stations`, { station_id: stationId, user }),
  unlinkStation: (projectId, stationId, user) => request('DELETE', `/projects/${projectId}/stations/${stationId}?user=${encodeURIComponent(user)}`),
  deleteStation: (id, user) => request('DELETE', `/stations/${id}?user=${encodeURIComponent(user)}`),
  stationProjects: (id) => request('GET', `/stations/${id}/projects`),
};

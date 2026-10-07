# CCTV Station Status

Data-entry and reporting app for *Status of CCTV System at Railway Stations (VSS), Northern Railway*. It replaces manual entry in the Excel sheet "Commissioned stations NR".

```
React (Vite)  ->  Express REST API  ->  Mongoose  ->  MongoDB Atlas (database "cctv")
  client/            server/                            collections: stations, station_history, counters
```

The browser never talks to MongoDB. Only the API does, using the connection string in `server/.env`.

## Quick start

Prerequisites: Node.js 18+ and a MongoDB Atlas cluster.

```bash
# once
npm install                          # project root (the dev launcher)
npm --prefix server install
npm --prefix client install

# configure the database (see "Configuration")
copy server\.env.example server\.env   # then paste your MONGODB_URI

npm run check-db                     # test the Atlas connection
npm run seed                         # optional: add one dummy TEST station
npm run dev                          # API on :4000 and website on :5173, together
```

Open http://localhost:5173.

| Command (from the project root) | Does |
|---|---|
| `npm run dev` | starts the API and the website together |
| `npm run dev:api` / `npm run dev:web` | starts just one of them |
| `npm run check-db` | tests the Atlas connection (shows host/database, never the password) |
| `npm run seed` | inserts the dummy TEST station |
| `npm test` | runs the API tests (in-memory MongoDB, never touches your cluster) |
| `npm run build` | builds the website into `client/dist` |

## Configuration

`server/.env` (git-ignored; copy from `server/.env.example`):

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | Atlas connection string. Put the real password in, without the `< >` brackets (URL-encode special characters) |
| `MONGODB_DB` | database name, `cctv` |
| `PORT` | API port, default 4000 |
| `CORS_ORIGIN` | the website address(es) allowed to call the API, comma separated. `*` while developing; set your real site address in production |

In Atlas, Network Access must allow the machine that runs the API. The credentials live only in `server/.env`; nothing in the client or the source code contains them.

The website calls the API at `/api` on its own address (Vite forwards it to `localhost:4000` in development). Only if the API is on a different address, set `VITE_API_URL` in `client/.env` (see `client/.env.example`). Anything starting with `VITE_` is public in the browser, so never put database details there.

## Data (MongoDB, Mongoose models in `server/models/`)

| Model | Collection | One document is | Notes |
|---|---|---|---|
| `Station` | `stations` | `{ sn, stn_code, station_name, zone, division, status, data{ all form fields }, created_at, updated_at, updated_by }` | required, typed identity fields; unique index on `(zone, stn_code)`; indexes on `sn`, `division`, `status`. `data` holds every form field by its key, so adding a form field needs no schema change |
| `StationHistory` | `station_history` | `{ station_id, action (create/update), changed_by, changed_at, changes{ field:{from,to} } }` | one row per save, field-level diff |
| `Counter` | `counters` | `{ _id:'stations', seq }` | atomic S.N. counter, so S.N. never repeats |

Collections and indexes are created automatically from the models when the API starts.

## API (`server/app.js`)

`GET /api/health` · `GET /api/stations` (`?full=1`, `zone`, `division`, `status`, `q`) · `GET /api/stations/:id` · `POST /api/stations` · `PUT /api/stations/:id` · `GET /api/stations/:id/history`

- Validation runs on the server with the same `shared/fields.js` rules as the browser (422 with `{ errors, warnings }`).
- Saving is an atomic compare-and-set on `updated_at`: if someone else saved first, the second save gets 409 and the app offers to reload.
- There is no login yet: everyone is recorded as "Operator".

## Project layout

```
client/            React + Vite website (client/src: pages, form components, api.js)
server/            Express API, Mongoose models, check-db, seed, tests
shared/fields.js   ONE source of truth: sections, fields, option lists, formulas, conditions, validation
shared/report.js   report definitions and buildReport()
shared/stationsMaster.js  station directory used to auto-fill station details
```

To add or change a field, edit `shared/fields.js` only. Colours are defined at the top of `client/src/styles.css`.

## What the app does

- **Stations**: a list grouped Zone > Division, with status tiles, search and filters. All filters live in the web address, so a filtered list can be bookmarked and survives a refresh.
- **Add / edit station (form)**: ten collapsible sections with a section list, auto-calculated fields, conditional fields, validation, and a stale-save check. Station details is section 1.
- **Station record**: everything entered for one station on a read-only page, with Scope and Actual side by side; Station details can be edited in place.
- **Report**: the two Excel summary tables (Nirbhaya, VSS D&E Ctg stns), built automatically from the stations. Every number links to the stations behind it. The counting rules are in `shared/report.js`.
- **History**: who changed what, and when, for every station.

Excel wording is used where it has been seen (the A-N headers, the sheet title, "Nos of Panic Buttons", "Month of Installation", "Year Installation"); other columns follow the original spec.

## Deploying to Vercel

The website is a standard Vite app: in Vercel set **Root Directory** to `client`, build command `npm run build`, output `dist`. `client/vercel.json` already routes every address to the app (so refreshing `/stations/...` works) while leaving `/api/` alone.

The API is currently a long-running Express server. Vercel runs backend code as serverless functions, so before deploying you either:
1. host the API somewhere that runs Node servers (Render, Railway, Fly.io...) and set `VITE_API_URL` to its address, or
2. adapt it to a Vercel serverless function (needs a small entry file and a cached Mongoose connection).

Either way: set `MONGODB_URI`, `MONGODB_DB` and `CORS_ORIGIN` as environment variables on the host (never in code), allow the host in Atlas Network Access (Vercel and most hosts use changing IPs, so Atlas will need `0.0.0.0/0`), and add a login before the API is public.

## NR station management (current UI)

Left menu: **Dashboard**, **Stations** (All, Commissioned, In Progress, Pending/Hindrance, Handover Pending, Drafts, Create), **Work Progress** (approved vs work done with variance and Shortfall / Over scope flags), **Handover & Commissioning**, **Infrastructure / Survey**, **Reports / Export** (CSV of every station).

- **Station detail** (`/stations/:id/view`): header card plus tabs Overview, Station Master, Approved Scope, Work Done, Non-STQC Phase-I, Commissioning & Handover, Survey / Infrastructure, Bandwidth, Audit / Change History. Every value carries its Excel column tag.
- **Create New NR Station** (`/stations/new`): 8-step wizard with Save Draft, Save & Continue and Review & Create. Drafts are real records (`draft: true`) that can be resumed (`/stations/:id/draft`). Creating applies the full rules: state required, commissioned needs install month/year, handover Y needs a date, N needs a target, a hindrance needs remarks or an available date.
- **Stage** (`lifecycle`): New, Survey Pending, Survey Completed, Work In Progress, Offered, Commissioned, Handover Pending, Handed Over, On Hold / Hindrance, Closed. It is the application's own field; the sheet's Status is never overwritten. For imported stations it was derived once (`deriveLifecycle` in `shared/fields.js`) and can be changed on the Overview tab.
- **Source traceability**: every form field has its Excel column (`col`, listed in the field definitions). Columns the app recalculates (A, P, AA, AN, AO) also keep the sheet's own value as `data.src_*`. `origin` is `excel_import` or `application`.
- Server tools: `import-excel.js` (one-off import), `migrate-source-values.js` (backs up to `server/backups/`, adds `src_*`, stage, origin), `migrate-phase1.js`, `rederive-lifecycle.js`. All are dry runs unless given `--write`.

## Out of scope so far

Login and roles, Excel import/export, and zones other than the ones in the form's list.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildReport } from '@shared/report.js';
import { api } from './api.js';

function ReportTable({ table, asOf }) {
  const { rows, total, extras } = table;
  // Every number opens the stations behind it (same scheme / zone / column), on the Stations page.
  const num = (value, key, zone) => {
    if (!value) return value === 0 ? 0 : '';
    const qs = new URLSearchParams({ scheme: table.scheme, bucket: key, ...(zone ? { zone } : {}) }).toString();
    return <Link to={`/stations/grouped?${qs}`} className="report-link" title="Show these stations">{value}</Link>;
  };
  const cells = (r, bold, zone) => (
    <>
      <td className="num-cell">{num(r.a, 'a', zone)}</td>
      <td className="num-cell">{num(r.b, 'b', zone)}</td>
      <td className="num-cell">{num(r.c, 'c', zone)}</td>
      <td className="num-cell">{num(r.d, 'd', zone)}</td>
      <td className="num-cell">{num(r.e, 'e', zone)}</td>
      {extras.map((x) => <td key={x.key} className="num-cell">{x.key === 'upgraded' ? '' : num(r[x.key], x.key, zone) || ''}</td>)}
    </>
  );
  return (
    <section className="report-table" aria-label={table.title}>
      <div className="table-wrap">
        <table>
          <caption>{table.title}</caption>
          <thead>
            <tr>
              <th rowSpan={2}>Rly</th>
              <th>{table.aLabel}</th>
              <th>Provided as per scope with full functionalities (Nos of Stations) till date {asOf}</th>
              <th>Provided partially completed / Go-live (Nos of Stations) including Phase-I</th>
              <th>Total Provided (Nos of Stations)</th>
              <th>Balance (Nos of Stations)</th>
              {extras.map((x) => <th key={x.key} className="grey">{x.label}</th>)}
            </tr>
            <tr className="letters">
              <th>a</th><th>b</th><th>c</th><th>d = b + c</th><th>e = a − d</th>
              {extras.map((x) => <th key={x.key} className="grey" />)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.zone} className={r.a === 0 ? 'zero-row' : ''}>
                <th scope="row">{r.zone}</th>
                {cells(r, false, r.zone)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {cells(total, true, '')}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function ReportPage() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [hideEmpty, setHideEmpty] = useState(true);

  const load = () => api.all().then(setRecords).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const report = useMemo(() => (records ? buildReport(records) : null), [records]);
  const tables = report?.tables.map((t) => (hideEmpty ? { ...t, rows: t.rows.filter((r) => r.a > 0) } : t));

  return (
    <div className="page report-page">
      <div className="list-head no-print">
        <h1>Report</h1>
        <div className="list-actions">
          <label className="check"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Hide zones with no stations</label>
          <a className="btn" href={api.exportUrl({})} download>Export all stations (CSV)</a>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <p className="muted no-print report-note">
        Built automatically from the station forms; nothing is typed here. Each station is counted by its
        zone and “Work done / proposed under” scheme.
      </p>

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {!report && !error && <p className="muted">Loading…</p>}
      {report && (
        <>
          {report.unassigned > 0 && (
            <div className="banner banner-warn no-print" role="status">
              {report.unassigned} of {report.stationCount} station{report.stationCount === 1 ? '' : 's'} not counted: no scheme selected in “Work done / proposed under” (section 5).
            </div>
          )}
          {tables.map((t) => <ReportTable key={t.id} table={t} asOf={report.asOf} />)}
          <ul className="report-defs">
            <li><b>b</b> Status “Completed”. <b>c</b> Status “Go Live”. <b>Hindrance</b> Status “Under Hindrance”.</li>
            <li><b>Stn dropped</b> Status “Removed”, or hindrance type “Station dropped” / “Removed from scope”. Dropped stations are not counted in b, c or Hindrance.</li>
            <li><b>Hindrance for partial go live to full live</b> Go Live stations that have a hindrance type. <b>New Station Introduced</b> “New station beyond scope” = Y.</li>
            <li><b>Upgraded to Nirbhaya</b> is not tracked by any form field yet, so it is left blank.</li>
          </ul>
        </>
      )}
    </div>
  );
}

const TONE = {
  Completed: 'green',
  'Go Live': 'blue',
  'Not Live': 'grey',
  'Under Hindrance': 'amber',
  Removed: 'red',
};

const LIFE_TONE = {
  New: 'grey',
  'Survey Pending': 'grey',
  'Survey Completed': 'blue',
  'Work In Progress': 'blue',
  Offered: 'blue',
  Commissioned: 'green',
  'Handover Pending': 'amber',
  'Handed Over': 'green',
  'On Hold / Hindrance': 'red',
  Closed: 'grey',
};

export default function StatusPill({ status }) {
  if (!status) return <span className="muted">—</span>;
  return <span className={`pill pill-${TONE[status] || 'grey'}`}>{status}</span>;
}

/** The application's own controlled lifecycle stage (not the sheet's status). */
export function LifecyclePill({ value, draft }) {
  return (
    <span>
      {value ? <span className={`pill pill-${LIFE_TONE[value] || 'grey'}`}>{value}</span> : <span className="muted">—</span>}
      {draft && <span className="pill pill-draft" title="Saved as a draft">Draft</span>}
    </span>
  );
}

export const LIFECYCLE_TONE = LIFE_TONE;

import { Link } from 'react-router-dom';

/** items: [{ label, to? }]; the last one is the current page. */
export default function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`}>
          {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
          {it.to && i < items.length - 1 ? <Link to={it.to}>{it.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

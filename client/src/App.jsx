import { createContext, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getRegion, setRegion as storeRegion } from './api.js';
import railtelLogo from './assets/railtel-logo.png';

export const UserContext = createContext({ user: 'Operator', region: 'NR', focusUser: () => {} });

export const REGION_NAMES = { ER: 'Eastern', NR: 'Northern', SR: 'Southern', WR: 'Western' };

function SideLink({ to, children, end = true }) {
  return <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'side-link on' : 'side-link')}>{children}</NavLink>;
}

export default function App() {
  const [user] = useState('Operator');
  const focusUser = useCallback(() => {}, []);
  const [region, setRegionState] = useState(getRegion);
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => { document.title = "Railtel Project Management"; }, []);
  useEffect(() => { setMenu(false); }, [loc.pathname, loc.search]);

  const pickRegion = (r) => {
    if (r === region) return;
    storeRegion(r);
    setRegionState(r);
    navigate('/stations');
  };

  return (
    <UserContext.Provider value={{ user, region, pickRegion, focusUser }}>
      <header className="topbar">
        <button type="button" className="menu-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>☰</button>
        <Link to="/" className="brand">
          <img src={railtelLogo} alt="RailTel Logo" className="brand-logo" />
          <span className="brand-text">
            <span className="brand-main">Railtel Project Management</span>
          </span>
        </Link>
      </header>
      <div className="shell">
        <aside className={`side ${menu ? 'open' : ''}`} aria-label="Main">
          <SideLink to="/dashboard">Dashboard</SideLink>
          <div className="side-group">Projects</div>
          <NavLink to="/projects" className={({ isActive }) => (isActive ? 'side-link sub on' : 'side-link sub')}>All Projects</NavLink>          <div className="side-group">Stations</div>
          <Link to="/stations" className={`side-link sub ${loc.pathname === '/stations' ? 'on' : ''}`}>All Stations</Link>
          <SideLink to="/stations/new"><span className="sub-plus">+</span> Create New Station</SideLink>
        </aside>
        <main>
          {/* keyed by region so every page reloads its data when the region changes */}
          <Outlet key={region} />
        </main>
      </div>
    </UserContext.Provider>
  );
}
import { useEffect, useMemo, useRef, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import FarmManagement from './components/FarmManagement';
import DevicesPage from './components/DevicesPage';
import AlertsPage from './components/AlertsPage';
import NotificationsPage from './components/NotificationsPage';
import IrrigationPage from './components/IrrigationPage';
import HistoryPage from './components/HistoryPage';
import ReportsPage from './components/ReportsPage';
import AccountPage, { ForcePassword } from './components/AccountPage';
import UsersPage from './components/UsersPage';
import SettingsPage from './components/SettingsPage';
import ReliabilityPage from './components/ReliabilityPage';
import { Avatar } from './components/ui';
import useDB, { resetDB } from './hooks/useDB';
import { NAV, SK } from './data/constants';
import { now, scope } from './data/db';
import logo from './assets/logo.png';

export default function App() {
  const [d, update, replace] = useDB();
  const [sid, setSid] = useState(() => { try { return JSON.parse(localStorage.getItem(SK))?.id || null; } catch (e) { return null; } });
  const user = useMemo(() => d.users.find((u) => u.id === sid && u.active !== false) || null, [d.users, sid]);
  const sd = useMemo(() => scope(d, user), [d, user]); // staff and viewers only see their assigned farms
  const [pg, setPg] = useState(() => location.hash.slice(1) || 'dash');
  const seen = useRef(null);
  const [pushes, setPushes] = useState([]);

  useEffect(() => {
    const f = () => setPg(location.hash.slice(1) || 'dash');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  useEffect(() => { seen.current = null; }, [user?.id]);
  useEffect(() => { // simulated push notifications for the signed-in user
    if (!user) return;
    const mine = d.notifs.filter((n) => n.to?.includes(user.id) && n.delivery?.[user.id]?.push === 'delivered');
    if (seen.current === null) { seen.current = new Set(mine.map((n) => n.id)); return; }
    const fresh = mine.filter((n) => !seen.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => { seen.current.add(n.id); setTimeout(() => setPushes((p) => p.filter((x) => x.id !== n.id)), 6000); });
    setPushes((p) => [...fresh.slice(0, 2), ...p].slice(0, 3));
  }, [d.notifs, user]);

  const signOut = () => { if (user) update(() => {}, 'Signed out', user.name); try { localStorage.removeItem(SK); } catch (e) {} setSid(null); };

  if (!user) {
    return <Login users={d.users} org={d.settings.org} onLogin={(u) => {
      try { localStorage.setItem(SK, JSON.stringify({ id: u.id })); } catch (e) {}
      update((n) => { n.users.find((q) => q.id === u.id).lastLogin = now(); }, 'Signed in', u.name);
      setSid(u.id);
    }} />;
  }
  if (user.mustChange) return <ForcePassword user={user} update={update} onSignOut={signOut} />;

  const items = NAV.filter((n) => n[3].includes(user.role));
  const cur = items.find((n) => n[0] === pg) || items[0];
  const badge = (k) => (k === 'alerts' ? sd.alertRecs.filter((a) => a.status === 'open').length : k === 'notif' ? d.notifs.filter((n) => n.to?.includes(user.id) && !n.readBy.includes(user.id)).length : 0);
  const P = {
    dash: <Dashboard d={sd} user={user} />,
    farms: <FarmManagement d={sd} update={update} user={user} />,
    dev: <DevicesPage d={sd} update={update} user={user} />,
    alerts: <AlertsPage d={sd} update={update} user={user} />,
    notif: <NotificationsPage d={sd} update={update} user={user} />,
    irr: <IrrigationPage d={sd} update={update} user={user} />,
    hist: <HistoryPage d={sd} user={user} />,
    rep: <ReportsPage d={sd} user={user} />,
    users: <UsersPage d={d} update={update} user={user} />,
    set: <SettingsPage d={sd} full={d} update={update} replace={replace} user={user} />,
    rel: <ReliabilityPage d={sd} update={update} user={user} />,
    acct: <AccountPage d={d} update={update} user={user} />,
  };

  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="brand"><img src={logo} alt="" /><div><b>AquaGrow</b><small>Sentinel</small></div></div>
        {items.map((n) => (
          <button key={n[0]} className={`nav${n[0] === cur[0] ? ' on' : ''}`} onClick={() => { location.hash = n[0]; }} aria-current={n[0] === cur[0] ? 'page' : undefined}>
            <i>{n[1]}</i><span>{n[2]}</span>{badge(n[0]) > 0 && <em className="bdg">{badge(n[0])}</em>}
          </button>
        ))}
      </nav>
      <main className="main">
        <header className="top">
          <h1>{cur[2]}</h1>
          <div className="who">
            {user.role === 'Owner' && <button className="btn" onClick={resetDB} title="Reset sample data, users and settings">Reset data</button>}
            <div className="nm" style={{ textAlign: 'right' }}><b>{user.name}</b><br /><span className="role">{user.role}</span></div>
            <a href="#acct" aria-label="My account"><Avatar u={user} /></a>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </header>
        {P[cur[0]]}
      </main>
      {pushes.length > 0 && (
        <div className="push" role="status">
          {pushes.map((n) => <div key={n.id} className={n.sev}><b>🔔 {n.title}</b><br />{n.msg}</div>)}
        </div>
      )}
    </div>
  );
}

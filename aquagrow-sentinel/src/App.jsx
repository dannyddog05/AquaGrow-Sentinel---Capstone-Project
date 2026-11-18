import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from './hooks/useRouter';
import HomePage from './components/HomePage';
import Login from './components/Login';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import Dashboard from './components/Dashboard';
import FarmManagement from './components/FarmManagement';
import DevicesPage from './components/DevicesPage';
import AlertsPage from './components/AlertsPage';
import NotificationsPage from './components/NotificationsPage';
import IrrigationPage from './components/IrrigationPage';
import HistoryPage, { ActivityLogsPage } from './components/HistoryPage';
import ReportsPage from './components/ReportsPage';
import AccountPage, { ForcePassword } from './components/AccountPage';
import UsersPage from './components/UsersPage';
import SettingsPage from './components/SettingsPage';
import ReliabilityPage from './components/ReliabilityPage';
import Tabs from './components/Tabs';
import Sidebar from './components/Sidebar';
import useDB, { resetDB } from './hooks/useDB';
import { LEGACY_ROUTE_MAP, NAV, SK } from './data/constants';
import { now, scope } from './data/db';
import authBg from './assets/sa.png';

const PUSH_BORDER = {
  critical: 'border-l-crit',
  warning: 'border-l-warn',
  offline: 'border-l-off',
};

const VALID_SEGMENTS = new Set(NAV.map((n) => n[0]));

export default function App() {
  const [d, update, replace] = useDB();
  const [sid, setSid] = useState(() => { try { return JSON.parse(localStorage.getItem(SK))?.id || null; } catch (e) { return null; } });
  const user = useMemo(() => d.users.find((u) => u.id === sid && u.active !== false) || null, [d.users, sid]);
  const sd = useMemo(() => scope(d, user), [d, user]); // staff and viewers only see their assigned farms
  const seen = useRef(null);
  const [pushes, setPushes] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect legacy hash routes (#farms, #dev, #notif, #acct, etc.) and old paths to canonical routes
  useEffect(() => {
    const h = location.hash.replace(/^#\/?/, '').toLowerCase();
    if (h && LEGACY_ROUTE_MAP[h]) {
      navigate(LEGACY_ROUTE_MAP[h], { replace: true });
      return;
    }
    const rawSeg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
    // Always show Home at "/" when opening the root URL
    if (!rawSeg) return;
    if (!user) {
      // Logged-out visitors: allow /login and /forgot-password, send everything else to Home ("/") first
      if (rawSeg === 'login' || rawSeg === 'forgot-password') return;
      navigate('/', { replace: true });
      return;
    }
    if (rawSeg === 'login' || rawSeg === 'forgot-password') {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (rawSeg !== 'alerts' && LEGACY_ROUTE_MAP[rawSeg]) {
      navigate(LEGACY_ROUTE_MAP[rawSeg], { replace: true });
      return;
    }
    if (!VALID_SEGMENTS.has(rawSeg)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (rawSeg === 'irrigation' && user.role === 'Viewer') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, location.hash, navigate, user]);

  // Close mobile drawer on route change or Escape key
  useEffect(() => { setDrawerOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

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

  const signOut = () => {
    if (user) update(() => {}, 'Signed out', user.name);
    try { localStorage.removeItem(SK); } catch (e) {}
    setSid(null);
    navigate('/', { replace: true });
  };

  const rootSeg = location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
  if (!rootSeg) return <HomePage />;

  if (!user) {
    if (rootSeg === 'forgot-password') return <ForgotPasswordPage />;
    return <Login users={d.users} org={d.settings.org} onLogin={(u) => {
      try { localStorage.setItem(SK, JSON.stringify({ id: u.id })); } catch (e) {}
      update((n) => { n.users.find((q) => q.id === u.id).lastLogin = now(); }, 'Signed in', u.name);
      setSid(u.id);
      navigate('/dashboard', { replace: true });
    }} />;
  }
  if (user.mustChange) return <ForcePassword user={user} update={update} onSignOut={signOut} />;

  const items = NAV.filter((n) => n[3].includes(user.role));
  const seg = location.pathname.replace(/^\/+/, '').split('/')[0].toLowerCase() || 'dashboard';
  const cur = items.find((n) => n[0] === seg) || items[0];

  // Sidebar badge shows ONLY unresolved alerts; unread notifications appear on the Notification Inbox tab only
  const unresolvedAlerts = sd.alertRecs.filter((a) => a.status !== 'resolved').length;
  const unreadNotifs = user.role === 'Viewer' ? 0 : d.notifs.filter((n) => n.to?.includes(user.id) && !n.readBy.includes(user.id)).length;
  const badge = (k) => (k === 'alerts' ? unresolvedAlerts : 0);

  const renderPage = () => {
    switch (cur[0]) {
      case 'farms-devices':
        return (
          <Tabs
            ariaLabel="Farms and Devices"
            tabs={[
              { id: 'farms', label: 'Farms', content: <FarmManagement d={sd} update={update} user={user} /> },
              { id: 'devices', label: 'Devices', content: <DevicesPage d={sd} update={update} user={user} /> },
            ]}
          />
        );
      case 'irrigation':
        return <IrrigationPage d={sd} update={update} user={user} />;
      case 'alerts':
        return (
          <Tabs
            ariaLabel="Alerts and Notifications"
            tabs={[
              { id: 'active', label: 'Active Alerts', content: <AlertsPage d={sd} update={update} user={user} /> },
              { id: 'notifications', label: 'Notification Inbox', badge: unreadNotifs, content: <NotificationsPage d={sd} update={update} user={user} /> },
            ]}
          />
        );
      case 'reports-logs':
        return (
          <Tabs
            ariaLabel="Reports and Logs"
            tabs={[
              { id: 'history', label: 'History', content: <HistoryPage d={sd} user={user} hideLogs /> },
              { id: 'logs', label: 'Logs', hidden: user.role !== 'Owner', content: <ActivityLogsPage d={sd} user={user} /> },
              { id: 'reports', label: 'Reports', content: <ReportsPage d={sd} user={user} /> },
            ]}
          />
        );
      case 'settings':
        return (
          <Tabs
            ariaLabel="Settings"
            tabs={[
              { id: 'account', label: 'My Account', content: <AccountPage d={d} update={update} user={user} /> },
              { id: 'users', label: 'Users & Access', hidden: user.role !== 'Owner', content: <UsersPage d={d} update={update} user={user} /> },
              { id: 'system-health', label: 'System Health', hidden: user.role === 'Viewer', content: <ReliabilityPage d={sd} update={update} user={user} /> },
              { id: 'preferences', label: 'Preferences', hidden: user.role === 'Viewer', content: <SettingsPage d={sd} full={d} update={update} replace={replace} user={user} /> },
            ]}
          />
        );
      case 'dashboard':
      default:
        return <Dashboard d={sd} update={update} user={user} onOpenDrawer={() => setDrawerOpen(true)} />;
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] bg-white">
      <Sidebar
        items={items}
        activeKey={cur[0]}
        badge={badge}
        sd={sd}
        user={user}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
        onNavigate={(path) => navigate(path)}
        onSignOut={signOut}
        onResetDB={resetDB}
      />

      <div className="relative min-w-0 min-h-screen">
        <div
          aria-hidden="true"
          className="fixed inset-0 lg:left-[260px] pointer-events-none select-none z-0 overflow-hidden bg-white"
        >
          <img
            src={authBg}
            alt=""
            className="w-full h-full object-cover object-right opacity-30 lg:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 via-[38%] to-white/20 lg:to-transparent" />
          <div className="absolute inset-0 bg-white/25 lg:bg-white/10" />
        </div>

        <main className="relative z-10 min-w-0 pb-6">
          {cur[0] !== 'dashboard' && (
            <header className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6 lg:py-3.5 bg-white/85 border-b border-line sticky top-0 z-[5] backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  className="lg:hidden border border-line bg-white rounded-[9px] w-9 h-9 grid place-items-center text-ink hover:bg-brand-soft flex-none"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open navigation menu"
                  aria-expanded={drawerOpen}
                >
                  ☰
                </button>
                <h1 className="text-[18px] sm:text-[22px] font-bold font-display m-0 truncate">{cur[2]}</h1>
              </div>
            </header>
          )}
          {renderPage()}
        </main>
      </div>

      {pushes.length > 0 && (
        <div
          className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] right-3 z-40 grid gap-2 w-[min(340px,calc(100vw-24px))]"
          role="status"
        >
          {pushes.map((n) => (
            <div
              key={n.id}
              className={`bg-white border border-line border-l-[5px] ${PUSH_BORDER[n.sev] || 'border-l-brand'} rounded-[10px] py-2.5 px-3 shadow-[0_8px_24px_rgba(0,0,0,0.14)] text-[13px]`}
            >
              <b>🔔 {n.title}</b>
              <br />
              {n.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link } from '../hooks/useRouter';
import { ago, PREFDEF } from '../data/db';
import { ACTS, BTN_SM, CARD, CARD_H2, CHK_LBL, INP, PG, STATUS_BG, TG_ROW, pill } from './ui';

const TYPE = { alert: 'Alert', escalation: 'Escalation', recovery: 'Recovered', assign: 'Assigned' };
const PREFS = [['push', 'Push notifications'], ['critical', 'Critical alerts'], ['warning', 'Warning alerts'], ['offline', 'Offline alerts'], ['recovery', 'Recovery notices']];

export default function NotificationsPage({ d, update, user }) {
  const [sev, setSev] = useState('all'), [area, setArea] = useState('all'), [unread, setUnread] = useState(false);
  if (user.role === 'Viewer') {
    return (
      <div className={PG}>
        <div className={CARD}>
          <h2 className={CARD_H2}>Notifications</h2>
          <p className="text-mut">Viewers have read-only access and do not receive notifications. Ask an owner for a staff account if you need alerts.</p>
        </div>
      </div>
    );
  }
  const mine = d.notifs.filter((n) => n.to?.includes(user.id));
  const isRead = (n) => n.readBy.includes(user.id);
  const list = mine.filter((n) => (sev === 'all' || n.sev === sev) && (area === 'all' || n.areaIds.includes(area)) && (!unread || !isRead(n)));
  const markRead = (ids) => update((n) => n.notifs.forEach((x) => { if (ids.includes(x.id) && !x.readBy.includes(user.id)) x.readBy.push(user.id); }));
  const un = mine.filter((n) => !isRead(n));

  return (
    <div className={PG}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-3.5 items-start">
        <div className={CARD}>
          <h2 className={CARD_H2}>
            <span className="inline-flex items-center gap-2">
              Notifications {un.length > 0 && <span className={pill('critical')}>{un.length} unread</span>}
            </span>
            <button className={BTN_SM} disabled={!un.length} onClick={() => markRead(un.map((n) => n.id))}>Mark all as read</button>
          </h2>
          <div className={`${ACTS} mb-2.5`}>
            <select className={INP} aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option><option value="normal">Recovered</option></select>
            <select className={INP} aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <label className={CHK_LBL}><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />Unread only</label>
          </div>
          {list.length === 0 && <p className="text-mut">No notifications to show.</p>}
          {list.map((n) => {
            const dl = n.delivery?.[user.id];
            return (
              <div
                key={n.id}
                className={`flex gap-2.5 py-[9px] border-b border-line last:border-b-0 text-[13px] ${isRead(n) ? '' : 'bg-[#f2faf5] -mx-2 px-2 rounded-[8px]'}`}
              >
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${STATUS_BG[n.sev] || 'bg-off'}`} />
                <div className="flex-1 min-w-0">
                  <div>
                    <b>{n.title}</b>{' '}
                    <span className="inline-block py-[1px] px-[9px] rounded-full text-[12px] font-bold border-[1.5px] border-line text-mut">{TYPE[n.type]}</span>
                  </div>
                  <div className="text-mut">{n.msg}</div>
                  <small className="text-mut">
                    {ago(n.t)} · In-app: {dl?.inapp || '—'} · Push: {dl?.push === 'off' ? 'off (turned off in your preferences)' : dl?.push || '—'}
                  </small>
                  <div className={`${ACTS} mt-1`}>
                    {n.alertId && <Link to="/alerts?tab=active" className="text-accent font-semibold hover:underline">View alerts</Link>}
                    {!isRead(n) && <button className={BTN_SM} onClick={() => markRead([n.id])}>Mark as read</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <PrefsCard d={d} update={update} user={user} />
      </div>
    </div>
  );
}

export function PrefsCard({ d, update, user }) {
  const prefs = { ...PREFDEF, ...(d.prefs[user.id] || {}) };
  const setPref = (k, v) => update((n) => { n.prefs[user.id] = { ...PREFDEF, ...(n.prefs[user.id] || {}), [k]: v }; }, 'Updated notification preferences', user.name);
  return (
    <div className={CARD}>
      <h2 className={CARD_H2}>What you receive</h2>
      <p className="text-mut mt-0 mb-2 text-[13px]">
        {user.role === 'Owner' ? 'As owner you receive alerts for every farm, plus escalations of critical alerts nobody has acknowledged.' : 'You receive alerts for the farms you are assigned to, plus any alert assigned to you.'}
      </p>
      {PREFS.map(([k, l]) => (
        <label className={TG_ROW} key={k}>
          <span>{l}</span>
          <input type="checkbox" checked={prefs[k]} onChange={(e) => setPref(k, e.target.checked)} />
        </label>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { ago, PREFDEF } from '../data/db';

const TYPE = { alert: 'Alert', escalation: 'Escalation', recovery: 'Recovered', assign: 'Assigned' };
const PREFS = [['push', 'Push notifications'], ['critical', 'Critical alerts'], ['warning', 'Warning alerts'], ['offline', 'Offline alerts'], ['recovery', 'Recovery notices']];

export default function NotificationsPage({ d, update, user }) {
  const [sev, setSev] = useState('all'), [area, setArea] = useState('all'), [unread, setUnread] = useState(false);
  if (user.role === 'Viewer') return <div className="pg"><div className="card"><h2>Notifications</h2><p className="mut">Viewers have read-only access and do not receive notifications. Ask an owner for a staff account if you need alerts.</p></div></div>;
  const mine = d.notifs.filter((n) => n.to?.includes(user.id));
  const isRead = (n) => n.readBy.includes(user.id);
  const list = mine.filter((n) => (sev === 'all' || n.sev === sev) && (area === 'all' || n.areaIds.includes(area)) && (!unread || !isRead(n)));
  const markRead = (ids) => update((n) => n.notifs.forEach((x) => { if (ids.includes(x.id) && !x.readBy.includes(user.id)) x.readBy.push(user.id); }));
  const un = mine.filter((n) => !isRead(n));

  return (
    <div className="pg">
      <div className="grid c2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h2>Notifications {un.length > 0 && <span className="pill critical">{un.length} unread</span>}
            <button className="btn sm" disabled={!un.length} onClick={() => markRead(un.map((n) => n.id))}>Mark all as read</button></h2>
          <div className="acts" style={{ marginBottom: 10 }}>
            <select className="inp" aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option><option value="normal">Recovered</option></select>
            <select className="inp" aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            <label className="chk"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />Unread only</label>
          </div>
          {list.length === 0 && <p className="mut">No notifications to show.</p>}
          {list.map((n) => {
            const dl = n.delivery?.[user.id];
            return (
              <div key={n.id} className={`nt${isRead(n) ? '' : ' unr'}`}>
                <span className={`dot ${n.sev}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div><b>{n.title}</b> <span className="chip">{TYPE[n.type]}</span></div>
                  <div className="mut">{n.msg}</div>
                  <small className="mut">{ago(n.t)} · In-app: {dl?.inapp || '—'} · Push: {dl?.push === 'off' ? 'off (turned off in your preferences)' : dl?.push || '—'}</small>
                  <div className="acts" style={{ marginTop: 4 }}>
                    {n.alertId && <a href="#alerts">View alerts</a>}
                    {!isRead(n) && <button className="btn sm" onClick={() => markRead([n.id])}>Mark as read</button>}
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
    <div className="card">
      <h2>What you receive</h2>
      <p className="mut" style={{ marginTop: 0, fontSize: 13 }}>{user.role === 'Owner' ? 'As owner you receive alerts for every farm, plus escalations of critical alerts nobody has acknowledged.' : 'You receive alerts for the farms you are assigned to, plus any alert assigned to you.'}</p>
      {PREFS.map(([k, l]) => <label className="tg" key={k}><span>{l}</span><input type="checkbox" checked={prefs[k]} onChange={(e) => setPref(k, e.target.checked)} /></label>)}
    </div>
  );
}

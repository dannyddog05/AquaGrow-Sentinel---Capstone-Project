import { useState } from 'react';
import { Modal, StatusDot } from './ui';
import { ago, now, notify, can } from '../data/db';

const ST = { open: 'Open', ack: 'Acknowledged', resolved: 'Resolved' };
const fmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const areasOf = (d, r) => r.areaIds.map((i) => d.areas.find((a) => a.id === i)?.name).filter(Boolean).join(', ') || 'System';

function Remark({ onPost }) {
  const [t, setT] = useState(''), [a, setA] = useState(true);
  return (
    <div style={{ marginTop: 10 }}>
      <textarea className="inp" style={{ width: '100%' }} rows="2" aria-label="Remark" placeholder="Add a remark or record an action taken" value={t} onChange={(e) => setT(e.target.value)} />
      <div className="acts" style={{ marginTop: 6, alignItems: 'center' }}>
        <label className="chk"><input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />Action taken</label>
        <button className="btn sm p" disabled={!t.trim()} onClick={() => { onPost(t.trim(), a); setT(''); }}>Post</button>
      </div>
    </div>
  );
}

function AlertCard({ d, r, canAct, h }) {
  const STAFF = d.users.filter((u) => u.role !== 'Viewer' && u.active !== false), nameOf = (id) => d.users.find((u) => u.id === id)?.name || '—';
  const [open, setOpen] = useState(false), done = r.status === 'resolved';
  const meta = [`Detected ${fmt(r.t)} (${ago(r.t)})`, r.assignee ? `Assigned to ${nameOf(r.assignee)}` : null, r.ackBy ? `Acknowledged by ${r.ackBy}` : null, done ? `Resolved by ${r.resolvedBy}` : null].filter(Boolean).join('  ·  ');
  return (
    <div className={`card ac2 ac2-${r.sev}${done ? ' done' : ''}`}>
      <div className="ac2-head">
        <div><div className="ac2-area">{areasOf(d, r)}</div><div className="ac2-title">{r.title}</div></div>
        <div className="ac2-tags">
          {r.escalated && !done && <span className="tag tag-bad">Escalated</span>}
          {r.status === 'ack' && <span className="tag">Acknowledged</span>}
          {done && <span className="tag tag-ok">Resolved</span>}
          <StatusDot s={r.sev} />
        </div>
      </div>
      <div className="ac2-facts">
        <div><small>Detected reading</small><div className="v">{r.value0}</div></div>
        <div><small>{done ? 'Last reading' : 'Now'}</small><div className="v">{r.value}</div></div>
        <div><small>Expected</small><div className="v">{r.range}</div></div>
      </div>
      <div className="ac2-meta">{meta}</div>
      <div className="ac2-rec"><b>What to do</b><p>{r.rec}</p></div>
      <div className="ac2-actions">
        {canAct && r.status === 'open' && <button className="btn sm p" onClick={() => h.ack(r)}>Acknowledge</button>}
        {canAct && !done && <button className="btn sm" onClick={() => h.askResolve(r)}>Resolve</button>}
        {canAct && done && <button className="btn sm" onClick={() => h.reopen(r)}>Reopen</button>}
        {canAct && !done && (
          <select className="inp" style={{ padding: '4px 8px' }} aria-label="Assign to" value={r.assignee || ''} onChange={(e) => h.assign(r, e.target.value)}>
            <option value="">Assign to…</option>{STAFF.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} timeline ({r.tl.length})</button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          {[...r.tl].reverse().map((e, i) => (
            <div className="tlr" key={i}><time>{fmt(e.t)}</time><div><b>{e.by}</b> · {e.type === 'action' ? <b style={{ color: 'var(--gd)' }}>Action taken: </b> : null}{e.text}</div></div>
          ))}
          {canAct && !done && <Remark onPost={(t, a) => h.remark(r, t, a)} />}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage({ d, update, user }) {
  const canAct = can(user, 'alerts'), nameOf = (id) => d.users.find((u) => u.id === id)?.name || '—';
  const [tab, setTab] = useState('active'), [sev, setSev] = useState('all'), [area, setArea] = useState('all'), [res, setRes] = useState(null), [note, setNote] = useState(''), [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400); };
  const act = (r, fn, msg) => update((n) => { const x = n.alertRecs.find((q) => q.id === r.id); if (x) fn(x, n); }, msg, user.name);
  const sys = (x, text) => x.tl.push({ t: now(), by: user.name, type: 'sys', text });

  const h = {
    ack: (r) => { act(r, (x) => { x.status = 'ack'; x.ackAt = now(); x.ackBy = user.name; sys(x, 'Acknowledged'); }, `Acknowledged alert "${r.title}"`); say('Alert acknowledged.'); },
    assign: (r, id) => act(r, (x, n) => {
      x.assignee = id || null; sys(x, id ? `Assigned to ${nameOf(id)}` : 'Unassigned');
      if (id) notify(n, { type: 'assign', sev: x.sev, title: 'Alert assigned to you', msg: `${x.title} · ${areasOf(n, x)}`, alertId: x.id, areaIds: x.areaIds, to: [id] });
    }, `Assigned alert "${r.title}"`),
    remark: (r, text, isAction) => { act(r, (x) => x.tl.push({ t: now(), by: user.name, type: isAction ? 'action' : 'remark', text }), `${isAction ? 'Recorded action on' : 'Added remark to'} alert "${r.title}"`); say('Saved.'); },
    askResolve: (r) => { setNote(''); setRes(r); },
    reopen: (r) => { act(r, (x) => { x.status = 'open'; x.resolvedAt = null; x.resolvedBy = null; x.ackAt = null; x.ackBy = null; x.hold = true; x.escalated = false; x.reopenedAt = now(); sys(x, 'Reopened'); }, `Reopened alert "${r.title}"`); say('Alert reopened.'); },
  };
  const resolve = () => {
    act(res, (x, n) => {
      x.status = 'resolved'; x.resolvedAt = now(); x.resolvedBy = user.name; x.hold = false; x.auto = false;
      if (note.trim()) x.tl.push({ t: now(), by: user.name, type: 'action', text: note.trim() });
      sys(x, 'Resolved'); n.snooze[x.key] = now() + 5 * 60000; // no repeat alert for the same condition for 5 min
    }, `Resolved alert "${res.title}"`);
    setRes(null); say('Alert resolved.');
  };

  const rank = { critical: 0, warning: 1, offline: 2 };
  const list = d.alertRecs
    .filter((r) => (tab === 'all' || (tab === 'active' ? r.status !== 'resolved' : r.status === tab)) && (sev === 'all' || r.sev === sev) && (area === 'all' || r.areaIds.includes(area)))
    .sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || rank[a.sev] - rank[b.sev] || b.t - a.t);
  const c = (s) => d.alertRecs.filter((r) => r.status === s).length;

  return (
    <div className="pg">
      <div className="grid s5">
        {[['Open', c('open')], ['Acknowledged', c('ack')], ['Critical active', d.alertRecs.filter((r) => r.sev === 'critical' && r.status !== 'resolved').length], ['Offline active', d.alertRecs.filter((r) => r.sev === 'offline' && r.status !== 'resolved').length], ['Resolved', c('resolved')]].map(([l, n]) => (
          <div className="card stat" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div className="bar2">
        <div className="tabs" role="tablist">
          {[['active', 'Active'], ['open', 'Open'], ['ack', 'Acknowledged'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="acts">
          <select className="inp" aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option></select>
          <select className="inp" aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
      </div>
      <p className="mut" style={{ margin: 0, fontSize: 13 }}>Alerts are created automatically from sensor readings and device status. One alert is kept per ongoing problem, so you are not notified twice. Critical alerts that stay open for {d.settings.escMin} minute(s) are escalated to the owner.</p>
      {list.length === 0 && <div className="card"><p className="mut">No alerts match these filters.</p></div>}
      {list.map((r) => <AlertCard key={r.id} d={d} r={r} canAct={canAct} h={h} />)}

      {res && (
        <Modal title="Resolve alert" onClose={() => setRes(null)} foot={<><button className="btn" onClick={() => setRes(null)}>Cancel</button><button className="btn p" onClick={resolve}>Mark resolved</button></>}>
          <p style={{ marginTop: 0 }}>{areasOf(d, res)} · {res.title}</p>
          <label className="fld">Action taken (optional)<textarea rows="3" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cleaned the filter and reduced feeding" /></label>
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

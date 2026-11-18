import { useState } from 'react';
import { ACTS, BAR2, BTN, BTN_GHOST, BTN_P, BTN_SM, BTN_SM_P, CARD, CHK_LBL, Card, Field, INNER_TABS, INP, Modal, PG, StatCard, StatStrip, StatusDot, innerTab } from './ui';
import { ago, now, notify, can } from '../data/db';

const fmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const areasOf = (d, r) => r.areaIds.map((i) => d.areas.find((a) => a.id === i)?.name).filter(Boolean).join(', ') || 'System';

const SEV_BORDER = {
  critical: 'border-l-crit',
  warning: 'border-l-warn',
  offline: 'border-l-off',
};

function Remark({ onPost }) {
  const [t, setT] = useState(''), [a, setA] = useState(true);
  return (
    <div className="mt-2.5">
      <textarea className={`${INP} w-full`} rows="2" aria-label="Remark" placeholder="Add a remark or record an action taken" value={t} onChange={(e) => setT(e.target.value)} />
      <div className={`${ACTS} mt-1.5`}>
        <label className={CHK_LBL}><input type="checkbox" checked={a} onChange={(e) => setA(e.target.checked)} />Action taken</label>
        <button className={BTN_SM_P} disabled={!t.trim()} onClick={() => { onPost(t.trim(), a); setT(''); }}>Post</button>
      </div>
    </div>
  );
}

function AlertCard({ d, r, canAct, h }) {
  const STAFF = d.users.filter((u) => u.role !== 'Viewer' && u.active !== false), nameOf = (id) => d.users.find((u) => u.id === id)?.name || '—';
  const [open, setOpen] = useState(false), done = r.status === 'resolved';
  const meta = [`Detected ${fmt(r.t)} (${ago(r.t)})`, r.assignee ? `Assigned to ${nameOf(r.assignee)}` : null, r.ackBy ? `Acknowledged by ${r.ackBy}` : null, done ? `Resolved by ${r.resolvedBy}` : null].filter(Boolean).join('  ·  ');
  return (
    <div className={`${CARD} border-l-[5px] ${SEV_BORDER[r.sev] || 'border-l-[#b8c2cc]'} p-3.5 sm:py-4 sm:px-[18px] ${done ? 'opacity-[0.82]' : ''}`}>
      <div className="flex justify-between gap-3 items-start flex-wrap">
        <div>
          <div className="font-display font-bold text-[17px] text-ink">{areasOf(d, r)}</div>
          <div className="text-mut text-[14px]">{r.title}</div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          {r.escalated && !done && <span className="text-[11px] font-bold py-0.5 px-[9px] rounded-full bg-[#fde7ef] text-[#a3234f]">Escalated</span>}
          {r.status === 'ack' && <span className="text-[11px] font-bold py-0.5 px-[9px] rounded-full bg-[#eef2f0] text-[#4a6159]">Acknowledged</span>}
          {done && <span className="text-[11px] font-bold py-0.5 px-[9px] rounded-full bg-brand-pale text-brand-dark">Resolved</span>}
          <StatusDot s={r.sev} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-[18px] gap-y-2.5 mt-3.5 mb-1.5">
        <div><small className="block text-mut text-[11px] uppercase tracking-[0.05em]">Detected reading</small><div className="font-display font-semibold text-[18px] text-ink">{r.value0}</div></div>
        <div><small className="block text-mut text-[11px] uppercase tracking-[0.05em]">{done ? 'Last reading' : 'Now'}</small><div className="font-display font-semibold text-[18px] text-ink">{r.value}</div></div>
        <div><small className="block text-mut text-[11px] uppercase tracking-[0.05em]">Expected</small><div className="font-display font-semibold text-[18px] text-ink">{r.range}</div></div>
      </div>
      <div className="text-mut text-[12.5px] mb-1.5">{meta}</div>
      <div className="bg-[#eef8f1] border border-[#cfe8d6] border-l-4 border-l-brand rounded-[10px] py-2.5 px-3.5 mt-2.5 mb-3.5">
        <b className="block text-[11px] uppercase tracking-[0.07em] text-brand-dark mb-0.5">What to do</b>
        <p className="m-0 text-[15px] font-semibold text-ink">{r.rec}</p>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {canAct && r.status === 'open' && <button className={BTN_SM_P} onClick={() => h.ack(r)}>Acknowledge</button>}
        {canAct && !done && <button className={BTN_SM} onClick={() => h.askResolve(r)}>Resolve</button>}
        {canAct && done && <button className={BTN_SM} onClick={() => h.reopen(r)}>Reopen</button>}
        {canAct && !done && (
          <select className={`${INP} py-1 px-2 text-[13px]`} aria-label="Assign to" value={r.assignee || ''} onChange={(e) => h.assign(r, e.target.value)}>
            <option value="">Assign to…</option>{STAFF.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <button className={BTN_GHOST} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'} timeline ({r.tl.length})</button>
      </div>
      {open && (
        <div className="mt-3">
          {[...r.tl].reverse().map((e, i) => (
            <div className="flex gap-2.5 py-1.5 border-b border-line last:border-b-0 text-[13px]" key={i}>
              <time className="text-mut whitespace-nowrap min-w-[92px]">{fmt(e.t)}</time>
              <div>
                <b>{e.by}</b> · {e.type === 'action' ? <b className="text-brand-dark">Action taken: </b> : null}{e.text}
              </div>
            </div>
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
    <div className={PG}>
      <StatStrip>
        {[['Open', c('open')], ['Acknowledged', c('ack')], ['Critical active', d.alertRecs.filter((r) => r.sev === 'critical' && r.status !== 'resolved').length], ['Offline active', d.alertRecs.filter((r) => r.sev === 'offline' && r.status !== 'resolved').length], ['Resolved', c('resolved')]].map(([l, n]) => (
          <StatCard key={l} value={n} label={l} />
        ))}
      </StatStrip>
      <div className={BAR2}>
        <div className={INNER_TABS} role="tablist">
          {[['active', 'Active'], ['open', 'Open'], ['ack', 'Acknowledged'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={innerTab(tab === k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className={ACTS}>
          <select className={INP} aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option></select>
          <select className={INP} aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </div>
      </div>
      <p className="text-mut m-0 text-[13px]">Alerts are created automatically from sensor readings and device status. One alert is kept per ongoing problem, so you are not notified twice. Critical alerts that stay open for {d.settings.escMin} minute(s) are escalated to the owner.</p>
      {list.length === 0 && <div className={CARD}><p className="text-mut">No alerts match these filters.</p></div>}
      {list.map((r) => <AlertCard key={r.id} d={d} r={r} canAct={canAct} h={h} />)}

      {res && (
        <Modal title="Resolve alert" onClose={() => setRes(null)} foot={<><button className={BTN} onClick={() => setRes(null)}>Cancel</button><button className={BTN_P} onClick={resolve}>Mark resolved</button></>}>
          <p className="mt-0 mb-2.5">{areasOf(d, res)} · {res.title}</p>
          <Field label="Action taken (optional)">
            <textarea rows="3" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cleaned the filter and reduced feeding" />
          </Field>
        </Modal>
      )}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2.5 rounded-[10px] z-20 text-[14px] shadow-lg"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

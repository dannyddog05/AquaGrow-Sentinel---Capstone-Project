import { useEffect, useState } from 'react';
import { Modal, StatusDot } from './ui';
import { M } from '../data/constants';
import { can, ago, now, areaStatus, devOf, thOf, pending, issueCmd, emergencyStop, trigLabel } from '../data/db';

const DUR = [[0, 'Until stopped (maximum runtime applies)'], [1, '1 minute (demo)'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes']];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtSec = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
const fmt = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const nextMinute = () => { const D = new Date(Date.now() + 60000); return `${String(D.getHours()).padStart(2, '0')}:${String(D.getMinutes()).padStart(2, '0')}`; };

function Automation({ d, p, a, canCtl, isOwner, upd }) {
  const th = thOf(d, a).moisture || {};
  const [stop, setStop] = useState(String(p.auto.stopAt)), [mr, setMr] = useState(String(p.maxRun)), [err, setErr] = useState('');
  const [sc, setSc] = useState({ time: nextMinute(), mins: 1, days: [0, 1, 2, 3, 4, 5, 6] });
  const saveStop = () => { const v = parseFloat(stop); if (isNaN(v) || v > 100 || (th.wl != null && v <= th.wl)) return setErr(`Stop level must be above ${th.wl ?? 0}% and at most 100%.`); setErr(''); upd((n) => { n.pumps.find((x) => x.id === p.id).auto.stopAt = v; }, `Set automatic stop level for ${a.name} to ${v}%`); };
  const saveMr = () => { const v = parseInt(mr); if (isNaN(v) || v < 1 || v > 60) return setErr('Maximum runtime must be 1 to 60 minutes.'); setErr(''); upd((n) => { n.pumps.find((x) => x.id === p.id).maxRun = v; }, `Set maximum pump runtime for ${a.name} to ${v} min`); };
  const edit = (fn, msg) => upd((n) => fn(n.pumps.find((x) => x.id === p.id)), msg);
  return (
    <details className="au">
      <summary>Automation and safety</summary>
      <label className="tg"><span>Automatic irrigation<br /><small className="mut">Starts below {th.wl ?? '—'}% (this area’s warning level) and stops at the level below.</small></span>
        <input type="checkbox" disabled={!canCtl || p.locked} checked={p.auto.enabled} onChange={(e) => edit((x) => { x.auto.enabled = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} automatic irrigation for ${a.name}`)} /></label>
      <div className="tg"><span>Stop at soil moisture (%)</span><span className="acts"><input className="inp" style={{ width: 80 }} type="number" disabled={!canCtl} value={stop} onChange={(e) => setStop(e.target.value)} onBlur={saveStop} /></span></div>
      <div className="tg"><span>Maximum runtime (minutes)<br /><small className="mut">The pump is shut off at this limit, whatever the mode.</small></span>
        <input className="inp" style={{ width: 80 }} type="number" disabled={!isOwner} value={mr} onChange={(e) => setMr(e.target.value)} onBlur={saveMr} /></div>
      {err && <div className="err" role="alert">{err}</div>}
      <b className="f" style={{ display: 'block', marginTop: 12 }}>Schedule</b>
      {p.schedules.length === 0 && <p className="mut" style={{ margin: '4px 0' }}>No schedules yet.</p>}
      {p.schedules.map((s) => (
        <div className="sch" key={s.id}>
          <b>{s.time}</b><span>{s.days.length === 7 ? 'Every day' : s.days.map((x) => DAYS[x]).join(', ')}</span><span>{s.mins} min</span>
          <label className="chk" style={{ marginLeft: 'auto', marginRight: 0 }}><input type="checkbox" disabled={!canCtl} checked={s.enabled} onChange={(e) => edit((x) => { x.schedules.find((q) => q.id === s.id).enabled = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} schedule ${s.time} for ${a.name}`)} />On</label>
          {canCtl && <button className="btn sm d" onClick={() => edit((x) => { x.schedules = x.schedules.filter((q) => q.id !== s.id); }, `Deleted schedule ${s.time} for ${a.name}`)}>Delete</button>}
        </div>
      ))}
      {canCtl && (
        <div className="sch">
          <input className="inp" type="time" aria-label="Start time" value={sc.time} onChange={(e) => setSc({ ...sc, time: e.target.value })} />
          <select className="inp" aria-label="Duration" value={sc.mins} onChange={(e) => setSc({ ...sc, mins: +e.target.value })}>{DUR.filter(([m]) => m > 0 && m <= p.maxRun).map(([m, l]) => <option key={m} value={m}>{m} min</option>)}</select>
          {DAYS.map((l, i) => <label className="chk" key={l} style={{ marginRight: 4 }}><input type="checkbox" checked={sc.days.includes(i)} onChange={() => setSc({ ...sc, days: sc.days.includes(i) ? sc.days.filter((x) => x !== i) : [...sc.days, i] })} />{l}</label>)}
          <button className="btn sm p" disabled={!sc.time || !sc.days.length} onClick={() => edit((x) => { x.schedules.push({ id: 'sc' + now(), time: sc.time, days: [...sc.days].sort(), mins: sc.mins, enabled: true, lastRun: null }); }, `Added schedule ${sc.time} for ${a.name}`)}>Add</button>
        </div>
      )}
    </details>
  );
}

function PumpCard({ d, p, canCtl, isOwner, ask, upd }) {
  const a = d.areas.find((x) => x.id === p.area), dv = devOf(d, a), online = dv?.status === 'online';
  const mo = a.r.moisture, th = thOf(d, a).moisture || {}, st = areaStatus(d, a), pc = pending(p), last = p.cmds[0], lastS = p.sessions[0];
  const alert = d.alertRecs.find((r) => r.key === `r:${a.id}:moisture` && r.status !== 'resolved');
  const run = p.state === 'on' && p.startedAt ? Math.round((now() - p.startedAt) / 1000) : 0;
  return (
    <div className="card">
      <div className="fh">
        <div><h2 style={{ marginBottom: 2 }}>{a.name}</h2><div className="mut" style={{ fontSize: 13 }}>{d.farms.find((f) => f.id === a.farm)?.name} · {a.crop} · {dv ? dv.code : 'No device'}</div></div>
        <StatusDot s={st} />
      </div>
      <div className="big">{mo ?? '—'}<small className="mut" style={{ fontSize: 16 }}>{M.moisture.u}</small> <small className="mut" style={{ fontSize: 13, fontWeight: 400 }}>soil moisture</small></div>
      <div className="mbar" aria-hidden="true"><i style={{ width: `${mo ?? 0}%` }} />{th.cl != null && <u style={{ left: `${th.cl}%`, background: '#d6336c' }} />}{th.wl != null && <u style={{ left: `${th.wl}%`, background: '#e08a00' }} />}</div>
      <small className="mut">Warning below {th.wl ?? '—'}% · critical below {th.cl ?? '—'}%</small>
      {alert && <div className="al critical" style={{ marginTop: 8 }}><b>Low soil moisture alert is active.</b> <a href="#alerts">View alert</a></div>}

      <div className="pump">
        {pc ? <span className="pill warning run">Waiting for ESP32 to confirm {pc.type.toUpperCase()}…</span>
          : p.state === 'on' ? <span className="pill online run">Pump ON · {fmtSec(run)}</span> : <span className="pill offline">Pump OFF</span>}
        {p.state === 'on' && p.stopAt && <small className="mut">stops in {fmtSec(Math.max(0, Math.round((p.stopAt - now()) / 1000)))}</small>}
        {p.state === 'on' && <small className="mut">limit {p.maxRun} min</small>}
      </div>
      {!online && <div className="banner" style={{ marginBottom: 8 }}>{dv ? `${dv.code} is ${dv.status}.` : 'No ESP32 assigned.'} The pump state shown is the last one confirmed. Commands will not be confirmed.</div>}
      {p.locked && <div className="banner" style={{ marginBottom: 8 }}>Emergency stop is active. Manual start, automatic mode and schedules are blocked.{isOwner && <> <button className="btn sm" onClick={() => ask({ t: 'reset', p })}>Reset emergency stop</button></>}</div>}
      {canCtl && (
        <div className="acts">
          <button className="btn p" disabled={p.locked || p.state === 'on' || !!pc || dv?.maint === 'under'} onClick={() => ask({ t: 'start', p })}>Start pump</button>
          <button className="btn" disabled={p.state !== 'on' || !!pc} onClick={() => ask({ t: 'stop', p })}>Stop pump</button>
          <button className="btn crit" onClick={() => ask({ t: 'estop', p })}>Emergency stop</button>
        </div>
      )}
      <div className="mut" style={{ fontSize: 13, marginTop: 10 }}>
        <div>Last started: {p.lastOn ? `${fmt(p.lastOn)} (${ago(p.lastOn)})` : 'never'}</div>
        {lastS && <div>Last run: {fmtSec(lastS.sec)} · {trigLabel(lastS.trigger)}</div>}
        {last && <div>Last command: {last.type.toUpperCase()} · {trigLabel(last.trigger)} · <b style={{ color: last.status === 'failed' ? 'var(--crit)' : last.status === 'confirmed' ? 'var(--gd)' : 'var(--warn)' }}>{last.status === 'confirmed' ? `confirmed by ${last.device}` : last.status}</b>{last.note && ` — ${last.note}`}</div>}
      </div>
      <Automation d={d} p={p} a={a} canCtl={canCtl} isOwner={isOwner} upd={upd} />
    </div>
  );
}

export default function IrrigationPage({ d, update, user }) {
  const canCtl = can(user, 'pumps'), isOwner = user.role === 'Owner';
  const [tab, setTab] = useState('ctl'), [cf, setCf] = useState(null), [mins, setMins] = useState(0), [toast, setToast] = useState(''), [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };
  const upd = (fn, msg) => update(fn, msg, user.name);
  const area = (p) => d.areas.find((a) => a.id === p.area)?.name;
  const pump = (n, p) => n.pumps.find((x) => x.id === p.id);
  const close = () => setCf(null);
  const ask = (x) => { if (d.settings.confirmHw === false && (x.t === 'start' || x.t === 'stop')) { setMins(0); confirm(x); } else { setMins(0); setCf(x); } };

  const confirm = (c = cf) => {
    const { t, p } = c;
    if (t === 'start') upd((n) => { const x = pump(n, p); if (!x.locked && x.state !== 'on' && !pending(x)) issueCmd(x, 'on', 'manual', user.name, mins ? Math.min(mins, x.maxRun) : null); }, `Sent pump ON command for ${area(p)}`);
    if (t === 'stop') upd((n) => { const x = pump(n, p); if (x.state === 'on' && !pending(x)) issueCmd(x, 'off', 'manual', user.name); }, `Sent pump OFF command for ${area(p)}`);
    if (t === 'estop') upd((n) => emergencyStop(pump(n, p), user.name), `EMERGENCY STOP sent for ${area(p)}`);
    if (t === 'estopAll') upd((n) => n.pumps.forEach((x) => emergencyStop(x, user.name)), 'EMERGENCY STOP sent for all pumps');
    if (t === 'reset') upd((n) => { pump(n, p).locked = false; }, `Reset emergency stop for ${area(p)}`);
    close();
    say(t === 'reset' ? 'Emergency stop reset.' : 'Command sent. Waiting for the ESP32 to confirm…');
  };

  const today = new Date().toDateString();
  const sessions = d.pumps.flatMap((p) => p.sessions.map((s) => ({ ...s, area: area(p) }))).sort((a, b) => b.start - a.start).slice(0, 40);
  const cmds = d.pumps.flatMap((p) => p.cmds.map((c) => ({ ...c, area: area(p) }))).sort((a, b) => b.t - a.t).slice(0, 40);
  const todaySec = d.pumps.reduce((s, p) => s + p.sessions.filter((x) => new Date(x.start).toDateString() === today).reduce((q, x) => q + x.sec, 0), 0);
  const moist = d.areas.filter((a) => a.kind === 'garden' && a.r.moisture != null);
  const Stat = ({ n, l }) => <div className="card stat"><div className="n">{n}</div><div className="l">{l}</div></div>;

  return (
    <div className="pg">
      <div className="bar2">
        <div className="tabs" role="tablist">{[['ctl', 'Pump control'], ['his', 'History']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
        {canCtl && d.pumps.length > 0 && <button className="btn crit" onClick={() => setCf({ t: 'estopAll' })}>Emergency stop all pumps</button>}
      </div>
      <div className="grid s5">
        <Stat n={d.pumps.filter((p) => p.state === 'on').length} l="Pumps running" />
        <Stat n={moist.length ? `${Math.round(moist.reduce((s, a) => s + a.r.moisture, 0) / moist.length)}%` : '—'} l="Average soil moisture" />
        <Stat n={fmtSec(todaySec)} l="Irrigation today" />
        <Stat n={d.pumps.filter((p) => p.locked).length} l="Emergency stops active" />
      </div>

      {tab === 'ctl' && (d.pumps.length === 0 ? <div className="card"><p className="mut">No gardens yet. Add a garden in Farm Management to control its pump.</p></div> : (
        <div className="grid c2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,420px),1fr))' }}>
          {d.pumps.map((p) => <PumpCard key={p.id} d={d} p={p} canCtl={canCtl} isOwner={isOwner} ask={ask} upd={upd} />)}
        </div>
      ))}

      {tab === 'his' && <>
        <div className="card"><h2>Irrigation sessions</h2><div className="tw"><table className="tbl" style={{ minWidth: 560 }}>
          <thead><tr><th>Area</th><th>Started</th><th>Duration</th><th>Started by</th><th>Stopped by</th></tr></thead>
          <tbody>{sessions.length === 0 && <tr><td colSpan="5" className="mut">No sessions recorded yet.</td></tr>}
            {sessions.map((s) => <tr key={s.id}><td>{s.area}</td><td>{fmt(s.start)}</td><td>{fmtSec(s.sec)}</td><td>{trigLabel(s.trigger)}</td><td>{s.stoppedBy}</td></tr>)}</tbody></table></div></div>
        <div className="card"><h2>Pump commands</h2><div className="tw"><table className="tbl" style={{ minWidth: 560 }}>
          <thead><tr><th>Area</th><th>Sent</th><th>Command</th><th>Source</th><th>Result</th></tr></thead>
          <tbody>{cmds.length === 0 && <tr><td colSpan="5" className="mut">No commands sent yet.</td></tr>}
            {cmds.map((c) => <tr key={c.id}><td>{c.area}</td><td>{fmt(c.t)}</td><td><b>{c.type.toUpperCase()}</b></td><td>{trigLabel(c.trigger)}{c.by && c.by !== 'System' ? ` · ${c.by}` : ''}</td>
              <td><span className={`pill ${c.status === 'confirmed' ? 'normal' : c.status === 'failed' ? 'critical' : 'warning'}`}>{c.status}</span>{c.note && <small className="mut"> {c.note}</small>}</td></tr>)}</tbody></table></div></div>
      </>}

      {cf && (
        <Modal title={{ start: 'Start pump?', stop: 'Stop pump?', estop: 'Emergency stop?', estopAll: 'Emergency stop all pumps?', reset: 'Reset emergency stop?' }[cf.t]} onClose={close}
          foot={<><button className="btn" onClick={close}>Cancel</button><button className={`btn ${cf.t === 'estop' || cf.t === 'estopAll' ? 'crit' : 'p'}`} onClick={() => confirm()}>{{ start: 'Send start command', stop: 'Send stop command', estop: 'Send emergency stop', estopAll: 'Send emergency stop', reset: 'Reset' }[cf.t]}</button></>}>
          {cf.p && <p style={{ marginTop: 0 }}><b>{area(cf.p)}</b></p>}
          {cf.t === 'start' && <label className="fld">Run for<select value={mins} onChange={(e) => setMins(+e.target.value)}>{DUR.filter(([m]) => m <= cf.p.maxRun).map(([m, l]) => <option key={m} value={m}>{l}</option>)}</select></label>}
          {cf.t === 'reset' ? <p>Manual start, automatic mode and schedules become available again. Automatic mode stays off until you turn it on.</p>
            : <p className="mut">The command is sent to the ESP32. The pump status changes only after the device confirms it.{(cf.t === 'estop' || cf.t === 'estopAll') && ' Automatic mode is switched off and starting is blocked until an owner resets it.'}</p>}
          {cf.p && devOf(d, d.areas.find((a) => a.id === cf.p.area))?.status !== 'online' && <div className="banner">This ESP32 is not online. The command will probably fail.</div>}
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

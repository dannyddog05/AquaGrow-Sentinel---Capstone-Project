import { useEffect, useState } from 'react';
import { Link } from '../hooks/useRouter';
import { ACTS, BANNER, BAR2, BTN, BTN_CRIT, BTN_P, BTN_SM, BTN_SM_D, BTN_SM_P, CARD, CARD_H2, CHK_LBL, ERR_TXT, Field, INNER_TABS, INP, Modal, PG, StatCard, StatStrip, StatusBadge, StatusDot, TG_ROW, innerTab, pill } from './ui';
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
    <details className="border-t border-line mt-3 pt-2.5">
      <summary className="cursor-pointer font-bold font-display">Automation and safety</summary>
      <label className={TG_ROW}>
        <span>Automatic irrigation<br /><small className="text-mut">Starts below {th.wl ?? '—'}% (this area’s warning level) and stops at the level below.</small></span>
        <input type="checkbox" disabled={!canCtl || p.locked} checked={p.auto.enabled} onChange={(e) => edit((x) => { x.auto.enabled = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} automatic irrigation for ${a.name}`)} />
      </label>
      <div className={TG_ROW}>
        <span>Stop at soil moisture (%)</span>
        <span className={ACTS}><input className={`${INP} w-20`} type="number" disabled={!canCtl} value={stop} onChange={(e) => setStop(e.target.value)} onBlur={saveStop} /></span>
      </div>
      <div className={TG_ROW}>
        <span>Maximum runtime (minutes)<br /><small className="text-mut">The pump is shut off at this limit, whatever the mode.</small></span>
        <input className={`${INP} w-20`} type="number" disabled={!isOwner} value={mr} onChange={(e) => setMr(e.target.value)} onBlur={saveMr} />
      </div>
      {err && <div className={ERR_TXT} role="alert">{err}</div>}
      <b className="font-display block mt-3">Schedule</b>
      {p.schedules.length === 0 && <p className="text-mut my-1">No schedules yet.</p>}
      {p.schedules.map((s) => (
        <div className="flex gap-2 flex-wrap items-center py-1.5 border-b border-line text-[13px]" key={s.id}>
          <b>{s.time}</b>
          <span>{s.days.length === 7 ? 'Every day' : s.days.map((x) => DAYS[x]).join(', ')}</span>
          <span>{s.mins} min</span>
          <label className={`${CHK_LBL} ml-auto mr-0`}>
            <input type="checkbox" disabled={!canCtl} checked={s.enabled} onChange={(e) => edit((x) => { x.schedules.find((q) => q.id === s.id).enabled = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} schedule ${s.time} for ${a.name}`)} />On
          </label>
          {canCtl && <button className={BTN_SM_D} onClick={() => edit((x) => { x.schedules = x.schedules.filter((q) => q.id !== s.id); }, `Deleted schedule ${s.time} for ${a.name}`)}>Delete</button>}
        </div>
      ))}
      {canCtl && (
        <div className="flex gap-2 flex-wrap items-center py-1.5 border-b border-line text-[13px]">
          <input className={INP} type="time" aria-label="Start time" value={sc.time} onChange={(e) => setSc({ ...sc, time: e.target.value })} />
          <select className={INP} aria-label="Duration" value={sc.mins} onChange={(e) => setSc({ ...sc, mins: +e.target.value })}>
            {DUR.filter(([m]) => m > 0 && m <= p.maxRun).map(([m]) => <option key={m} value={m}>{m} min</option>)}
          </select>
          {DAYS.map((l, i) => (
            <label className="inline-flex gap-1.5 items-center font-semibold mr-1" key={l}>
              <input type="checkbox" checked={sc.days.includes(i)} onChange={() => setSc({ ...sc, days: sc.days.includes(i) ? sc.days.filter((x) => x !== i) : [...sc.days, i] })} />{l}
            </label>
          ))}
          <button className={BTN_SM_P} disabled={!sc.time || !sc.days.length} onClick={() => edit((x) => { x.schedules.push({ id: 'sc' + now(), time: sc.time, days: [...sc.days].sort(), mins: sc.mins, enabled: true, lastRun: null }); }, `Added schedule ${sc.time} for ${a.name}`)}>Add</button>
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
    <div className={CARD}>
      <div className="flex flex-col sm:flex-row justify-between gap-2.5 flex-wrap items-start mb-3">
        <div>
          <h2 className="text-[16px] font-bold font-display mb-0.5">{a.name}</h2>
          <div className="text-mut text-[13px]">{d.farms.find((f) => f.id === a.farm)?.name} · {a.crop} · {dv ? dv.code : 'No device'}</div>
        </div>
        <StatusDot s={st} />
      </div>
      <div className="font-display font-bold text-[34px] leading-none">
        {mo ?? '—'}<small className="text-mut text-[16px]">{M.moisture.u}</small>{' '}
        <small className="text-mut text-[13px] font-sans font-normal">soil moisture</small>
      </div>
      <div className="relative h-3.5 rounded-full bg-[#e8efec] overflow-hidden my-1.5" aria-hidden="true">
        <i className="block h-full bg-gradient-to-r from-accent to-brand transition-[width] duration-[600ms]" style={{ width: `${mo ?? 0}%` }} />
        {th.cl != null && <u className="absolute top-0 bottom-0 w-[3px] bg-crit" style={{ left: `${th.cl}%` }} />}
        {th.wl != null && <u className="absolute top-0 bottom-0 w-[3px] bg-warn" style={{ left: `${th.wl}%` }} />}
      </div>
      <small className="text-mut">Warning below {th.wl ?? '—'}% · critical below {th.cl ?? '—'}%</small>
      {alert && (
        <div className="border-l-[5px] border-crit bg-[#fff2f6] py-2.5 px-3 rounded-[8px] mt-2 text-[13px]">
          <b>Low soil moisture alert is active.</b> <Link to="/alerts?tab=active" className="text-accent font-semibold hover:underline">View alert</Link>
        </div>
      )}

      <div className="flex gap-2.5 items-center flex-wrap my-2.5">
        {pc ? (
          <span className={`${pill('warning')} text-[14px] px-3.5 py-1 animate-pulse-pump`}>Waiting for ESP32 to confirm {pc.type.toUpperCase()}…</span>
        ) : p.state === 'on' ? (
          <span className={`${pill('online')} text-[14px] px-3.5 py-1 animate-pulse-pump`}>Pump ON · {fmtSec(run)}</span>
        ) : (
          <span className={`${pill('offline')} text-[14px] px-3.5 py-1`}>Pump OFF</span>
        )}
        {p.state === 'on' && p.stopAt && <small className="text-mut">stops in {fmtSec(Math.max(0, Math.round((p.stopAt - now()) / 1000)))}</small>}
        {p.state === 'on' && <small className="text-mut">limit {p.maxRun} min</small>}
      </div>
      {!online && (
        <div className={`${BANNER} mb-2`}>
          {dv ? `${dv.code} is ${dv.status}.` : 'No ESP32 assigned.'} The pump state shown is the last one confirmed. Commands will not be confirmed.
        </div>
      )}
      {p.locked && (
        <div className={`${BANNER} mb-2`}>
          Emergency stop is active. Manual start, automatic mode and schedules are blocked.
          {isOwner && <> <button className={BTN_SM} onClick={() => ask({ t: 'reset', p })}>Reset emergency stop</button></>}
        </div>
      )}
      {canCtl && (
        <div className={ACTS}>
          <button className={BTN_P} disabled={p.locked || p.state === 'on' || !!pc || dv?.maint === 'under'} onClick={() => ask({ t: 'start', p })}>Start pump</button>
          <button className={BTN} disabled={p.state !== 'on' || !!pc} onClick={() => ask({ t: 'stop', p })}>Stop pump</button>
          <button className={BTN_CRIT} onClick={() => ask({ t: 'estop', p })}>Emergency stop</button>
        </div>
      )}
      <div className="text-mut text-[13px] mt-2.5">
        <div>Last started: {p.lastOn ? `${fmt(p.lastOn)} (${ago(p.lastOn)})` : 'never'}</div>
        {lastS && <div>Last run: {fmtSec(lastS.sec)} · {trigLabel(lastS.trigger)}</div>}
        {last && (
          <div>
            Last command: {last.type.toUpperCase()} · {trigLabel(last.trigger)} ·{' '}
            <b className={last.status === 'failed' ? 'text-crit' : last.status === 'confirmed' ? 'text-brand-dark' : 'text-warn'}>
              {last.status === 'confirmed' ? `confirmed by ${last.device}` : last.status}
            </b>
            {last.note && ` — ${last.note}`}
          </div>
        )}
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

  return (
    <div className={PG}>
      <div className={BAR2}>
        <div className={INNER_TABS} role="tablist">
          {[['ctl', 'Pump control'], ['his', 'History']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={innerTab(tab === k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {canCtl && d.pumps.length > 0 && <button className={BTN_CRIT} onClick={() => setCf({ t: 'estopAll' })}>Emergency stop all pumps</button>}
      </div>
      <StatStrip>
        <StatCard value={d.pumps.filter((p) => p.state === 'on').length} label="Pumps running" />
        <StatCard value={moist.length ? `${Math.round(moist.reduce((s, a) => s + a.r.moisture, 0) / moist.length)}%` : '—'} label="Average soil moisture" />
        <StatCard value={fmtSec(todaySec)} label="Irrigation today" />
        <StatCard value={d.pumps.filter((p) => p.locked).length} label="Emergency stops active" />
      </StatStrip>

      {tab === 'ctl' && (d.pumps.length === 0 ? (
        <div className={CARD}><p className="text-mut">No gardens yet. Add a garden in Farm Management to control its pump.</p></div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,420px),1fr))' }}>
          {d.pumps.map((p) => <PumpCard key={p.id} d={d} p={p} canCtl={canCtl} isOwner={isOwner} ask={ask} upd={upd} />)}
        </div>
      ))}

      {tab === 'his' && (
        <>
          <div className={CARD}>
            <h2 className={CARD_H2}>Irrigation sessions</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px] min-w-[560px]">
                <thead>
                  <tr>
                    {['Area', 'Started', 'Duration', 'Started by', 'Stopped by'].map((h) => (
                      <th key={h} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 && <tr><td colSpan="5" className="text-mut py-2.5 px-2 border-b border-line">No sessions recorded yet.</td></tr>}
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{s.area}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{fmt(s.start)}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{fmtSec(s.sec)}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{trigLabel(s.trigger)}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{s.stoppedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={CARD}>
            <h2 className={CARD_H2}>Pump commands</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px] min-w-[560px]">
                <thead>
                  <tr>
                    {['Area', 'Sent', 'Command', 'Source', 'Result'].map((h) => (
                      <th key={h} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cmds.length === 0 && <tr><td colSpan="5" className="text-mut py-2.5 px-2 border-b border-line">No commands sent yet.</td></tr>}
                  {cmds.map((c) => (
                    <tr key={c.id}>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{c.area}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{fmt(c.t)}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle"><b>{c.type.toUpperCase()}</b></td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{trigLabel(c.trigger)}{c.by && c.by !== 'System' ? ` · ${c.by}` : ''}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">
                        <span className={pill(c.status === 'confirmed' ? 'normal' : c.status === 'failed' ? 'critical' : 'warning')}>{c.status}</span>
                        {c.note && <small className="text-mut"> {c.note}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {cf && (
        <Modal
          title={{ start: 'Start pump?', stop: 'Stop pump?', estop: 'Emergency stop?', estopAll: 'Emergency stop all pumps?', reset: 'Reset emergency stop?' }[cf.t]}
          onClose={close}
          foot={
            <>
              <button className={BTN} onClick={close}>Cancel</button>
              <button className={cf.t === 'estop' || cf.t === 'estopAll' ? BTN_CRIT : BTN_P} onClick={() => confirm()}>
                {{ start: 'Send start command', stop: 'Send stop command', estop: 'Send emergency stop', estopAll: 'Send emergency stop', reset: 'Reset' }[cf.t]}
              </button>
            </>
          }
        >
          {cf.p && <p className="mt-0 mb-2"><b>{area(cf.p)}</b></p>}
          {cf.t === 'start' && (
            <Field label="Run for">
              <select value={mins} onChange={(e) => setMins(+e.target.value)}>
                {DUR.filter(([m]) => m <= cf.p.maxRun).map(([m, l]) => <option key={m} value={m}>{l}</option>)}
              </select>
            </Field>
          )}
          {cf.t === 'reset' ? (
            <p>Manual start, automatic mode and schedules become available again. Automatic mode stays off until you turn it on.</p>
          ) : (
            <p className="text-mut">
              The command is sent to the ESP32. The pump status changes only after the device confirms it.
              {(cf.t === 'estop' || cf.t === 'estopAll') && ' Automatic mode is switched off and starting is blocked until an owner resets it.'}
            </p>
          )}
          {cf.p && devOf(d, d.areas.find((a) => a.id === cf.p.area))?.status !== 'online' && (
            <div className={`${BANNER} mt-2`}>This ESP32 is not online. The command will probably fail.</div>
          )}
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

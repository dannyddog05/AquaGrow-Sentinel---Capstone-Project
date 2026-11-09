import { useRef, useState } from 'react';
import { APP_VERSION, LATEST_FW, M, STYPES } from '../data/constants';
import { can, calibState, now, ago, recordTh, thOf, metricsOf } from '../data/db';
import { download } from '../data/exporters';
import { Confirm, DataTable, Field, Modal, useToast } from './ui';
import { ThresholdFields, parseTh } from './ThresholdEditor';
import { CalForm } from './SensorsTab';
import { PrefsCard } from './NotificationsPage';

const fmt = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never');
const rng = (t) => [t.wl != null && `< ${t.wl}`, t.wh != null && `> ${t.wh}`].filter(Boolean).join(' or ') || '—';
const crt = (t) => [t.cl != null && `< ${t.cl}`, t.ch != null && `> ${t.ch}`].filter(Boolean).join(' or ') || '—';
const lv = (t) => Object.entries(t || {}).map(([k, v]) => `${{ cl: 'crit<', wl: 'warn<', wh: 'warn>', ch: 'crit>' }[k]}${v}`).join(' ');

/* ---------- Application ---------- */
function AppTab({ d, update, user, say }) {
  const [f, setF] = useState({ org: d.settings.org, esc: String(d.settings.escMin), confirmHw: d.settings.confirmHw !== false }), [err, setErr] = useState({});
  const save = () => {
    const x = {}, esc = parseInt(f.esc);
    if (!f.org.trim() || f.org.length > 60) x.org = 'Enter a name (up to 60 characters).';
    if (isNaN(esc) || esc < 1 || esc > 60) x.esc = 'Enter 1 to 60 minutes.';
    setErr(x);
    if (Object.keys(x).length) return;
    update((n) => { n.settings = { ...n.settings, org: f.org.trim(), escMin: esc, confirmHw: f.confirmHw }; }, 'Changed application settings', user.name);
    say('Settings saved.');
  };
  return (
    <div className="grid c2" style={{ alignItems: 'start' }}>
      <div className="card"><h2>Application settings</h2>
        <Field label="Farm or organization name" err={err.org}><input value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} /></Field>
        <Field label="Escalate unacknowledged critical alerts after (minutes)" err={err.esc}><input type="number" value={f.esc} onChange={(e) => setF({ ...f, esc: e.target.value })} /></Field>
        <label className="tg"><span>Ask for confirmation before hardware commands<br /><small className="mut">Pump start and stop, and maintenance mode. Emergency stop always asks.</small></span><input type="checkbox" checked={f.confirmHw} onChange={(e) => setF({ ...f, confirmHw: e.target.checked })} /></label>
        <button className="btn p" style={{ marginTop: 12 }} onClick={save}>Save settings</button>
      </div>
      <div className="grid">
        <div className="card"><h2>Versions</h2>
          <dl className="kv"><dt>Application</dt><dd>AquaGrow Sentinel {APP_VERSION}</dd><dt>Latest firmware</dt><dd>{LATEST_FW}</dd></dl>
          <DataTable columns={['Device', 'Firmware', 'Status']} rows={d.devices.map((v) => [v.code, v.fw || '—', v.fw === LATEST_FW ? 'Up to date' : v.fw && v.fw !== '—' ? 'Update available' : 'Unknown'])} />
        </div>
        <PrefsCard d={d} update={update} user={user} />
      </div>
    </div>
  );
}

/* ---------- Thresholds & calibration ---------- */
function ThrTab({ d, update, user, say }) {
  const canTh = can(user, 'thresholds'), canDev = can(user, 'devices'), owner = user.role === 'Owner';
  const [mod, setMod] = useState(null), [vals, setVals] = useState({}), [err, setErr] = useState(''), close = () => setMod(null);
  const open = (scope, m) => { const t = scope === 'default' ? d.th[m] : thOf(d, d.areas.find((a) => a.id === scope))[m]; setVals(Object.fromEntries(Object.entries(t || {}).map(([k, v]) => [k, String(v)]))); setErr(''); setMod({ t: 'th', scope, m }); };
  const save = () => {
    const { v, err: e } = parseTh(mod.m, vals); if (e) return setErr(e);
    const a = mod.scope === 'default' ? null : d.areas.find((x) => x.id === mod.scope), label = a ? a.name : 'Default (all areas)', before = a ? thOf(d, a)[mod.m] : d.th[mod.m];
    update((n) => { if (a) { const t = n.areas.find((x) => x.id === a.id); t.th = { ...(t.th || {}), [mod.m]: v }; } else n.th[mod.m] = v; recordTh(n, user.name, label, mod.m, before, v); }, `Changed threshold for "${label}": ${M[mod.m].n}`, user.name);
    close(); say('Thresholds saved.');
  };
  const useDefault = () => {
    const a = d.areas.find((x) => x.id === mod.scope), before = thOf(d, a)[mod.m];
    update((n) => { const t = n.areas.find((x) => x.id === a.id); const c = { ...(t.th || {}) }; delete c[mod.m]; t.th = c; recordTh(n, user.name, a.name, mod.m, before, n.th[mod.m]); }, `Changed threshold for "${a.name}": ${M[mod.m].n} back to default`, user.name);
    close(); say('Using the default levels.');
  };
  const calibrate = (c) => { const s = mod.s; update((n) => { n.sensors.find((x) => x.id === s.id).calib = c; n.maintLog.unshift({ id: 'm' + now(), t: now(), by: user.name, type: 'calibration', targetId: s.id, targetLabel: s.id, notes: c.note, result: c.result }); }, `Recorded calibration (${c.result}) for ${s.id}`, user.name); close(); say('Calibration recorded.'); };
  const CS = { ok: ['Calibrated', 'normal'], due: ['Due', 'warning'], never: ['Not calibrated', 'offline'], failed: ['Failed', 'critical'] };
  const rows = d.areas.flatMap((a) => metricsOf(a).map((m) => ({ a, m, t: thOf(d, a)[m] || {}, custom: !!(a.th && a.th[m]) })));
  return (
    <>
      <div className="card"><h2>Default levels</h2>
        <p className="mut" style={{ marginTop: 0, fontSize: 13 }}>Used by every garden and pond that has no levels of its own. {!owner && 'Only an owner can change the defaults.'}</p>
        <div className="tw"><table className="tbl" style={{ minWidth: 520 }}><thead><tr><th>Sensor</th><th>Warning</th><th>Critical</th><th></th></tr></thead>
          <tbody>{Object.keys(M).map((m) => <tr key={m}><td>{M[m].n}</td><td>{rng(d.th[m] || {})}{M[m].u}</td><td>{crt(d.th[m] || {})}{M[m].u}</td><td>{owner && canTh && <button className="btn sm" onClick={() => open('default', m)}>Edit</button>}</td></tr>)}</tbody></table></div></div>
      <div className="card"><h2>Levels per garden and pond</h2>
        <div className="tw"><table className="tbl" style={{ minWidth: 620 }}><thead><tr><th>Area</th><th>Sensor</th><th>Warning</th><th>Critical</th><th>Levels</th><th></th></tr></thead>
          <tbody>{rows.length === 0 && <tr><td colSpan="6" className="mut">No areas yet.</td></tr>}
            {rows.map(({ a, m, t, custom }) => <tr key={a.id + m}><td>{a.name}</td><td>{M[m].n}</td><td>{rng(t)}{M[m].u}</td><td>{crt(t)}{M[m].u}</td><td><span className={`pill ${custom ? 'warning' : 'offline'}`}>{custom ? 'Custom' : 'Default'}</span></td><td>{canTh && <button className="btn sm" onClick={() => open(a.id, m)}>Edit</button>}</td></tr>)}</tbody></table></div></div>
      <div className="card"><h2>Sensor calibration</h2>
        <div className="tw"><table className="tbl" style={{ minWidth: 640 }}><thead><tr><th>Sensor</th><th>Type</th><th>Area</th><th>Last calibration</th><th>Result</th><th>State</th><th></th></tr></thead>
          <tbody>{d.sensors.length === 0 && <tr><td colSpan="7" className="mut">No sensors registered.</td></tr>}
            {d.sensors.map((s) => { const cs = calibState(s); return <tr key={s.id}><td><b>{s.id}</b></td><td>{STYPES[s.type].name}</td><td>{d.areas.find((a) => a.id === s.area)?.name || '—'}</td><td>{s.calib ? new Date(s.calib.t).toLocaleDateString() : 'Never'}</td><td>{s.calib ? s.calib.result : '—'}</td><td><span className={`pill ${CS[cs][1]}`}>{CS[cs][0]}</span></td><td>{canDev && <button className="btn sm" onClick={() => setMod({ t: 'cal', s })}>Record</button>}</td></tr>; })}</tbody></table></div></div>
      <div className="card"><h2>Previous threshold settings</h2>
        <DataTable columns={['When', 'By', 'Area', 'Sensor', 'Before', 'After']} rows={(d.thHist || []).filter((h) => owner || d.areas.some((a) => a.name === h.scope)).map((h) => [fmt(h.t), h.by, h.scope, M[h.metric].n, lv(h.before), lv(h.after)])} empty="No threshold changes recorded yet." step={15} /></div>
      {mod?.t === 'th' && (
        <Modal title={`${M[mod.m].n} levels · ${mod.scope === 'default' ? 'Default' : d.areas.find((a) => a.id === mod.scope).name}`} onClose={close}
          foot={<>{mod.scope !== 'default' && d.areas.find((a) => a.id === mod.scope).th?.[mod.m] && <button className="btn" style={{ marginRight: 'auto' }} onClick={useDefault}>Use default</button>}<button className="btn" onClick={close}>Cancel</button><button className="btn p" onClick={save}>Save levels</button></>}>
          <ThresholdFields m={mod.m} val={vals} set={setVals} />{err && <div className="err" role="alert">{err}</div>}
        </Modal>)}
      {mod?.t === 'cal' && <CalForm s={mod.s} onSave={calibrate} onClose={close} />}
    </>
  );
}

/* ---------- Maintenance ---------- */
const MT = { battery: 'Battery replacement', cleaning: 'Sensor cleaning', calibration: 'Sensor calibration', repair: 'Hardware repair' };
function MntTab({ d, update, user, say }) {
  const can2 = can(user, 'devices');
  const [f, setF] = useState({ type: 'battery', target: '', notes: '', result: 'Pass' }), [err, setErr] = useState({}), [cf, setCf] = useState(null);
  const sensorType = f.type === 'cleaning' || f.type === 'calibration', targets = sensorType ? d.sensors.map((s) => ({ id: s.id, label: `${s.id} · ${M[s.type].n}` })) : d.devices.map((v) => ({ id: v.id, label: `${v.code} · ${v.name}` }));
  const tgt = targets.some((t) => t.id === f.target) ? f.target : '';
  const add = () => {
    const x = {}; if (!tgt) x.target = 'Choose what was worked on.'; if (f.type === 'repair' && !f.notes.trim()) x.notes = 'Describe the repair.';
    setErr(x); if (Object.keys(x).length) return;
    const lab = targets.find((t) => t.id === tgt).label.split(' · ')[0];
    update((n) => {
      n.maintLog.unshift({ id: 'm' + now(), t: now(), by: user.name, type: f.type, targetId: tgt, targetLabel: lab, notes: f.notes.trim(), result: f.type === 'calibration' ? f.result : null });
      if (f.type === 'battery') n.devices.find((v) => v.id === tgt).battery = 100;
      if (f.type === 'calibration') n.sensors.find((s) => s.id === tgt).calib = { t: now(), result: f.result, note: f.notes.trim() };
    }, `Recorded ${MT[f.type].toLowerCase()} for ${lab}`, user.name);
    setF({ ...f, notes: '' }); say('Maintenance recorded.');
  };
  const toggle = (v) => update((n) => { const x = n.devices.find((q) => q.id === v.id); x.maint = x.maint === 'under' ? 'ok' : 'under'; }, `${v.maint === 'under' ? 'Ended' : 'Enabled'} maintenance mode for ${v.code}`, user.name);
  const ask = (v) => (v.maint !== 'under' && d.settings.confirmHw !== false ? setCf(v) : (toggle(v), say(v.maint === 'under' ? 'Maintenance mode ended.' : 'Maintenance mode on.')));
  return (
    <>
      <div className="card"><h2>Maintenance mode</h2>
        <p className="mut" style={{ marginTop: 0, fontSize: 13 }}>While a device is in maintenance mode its alerts are paused and the pump will not start automatically or be started by hand.</p>
        {d.devices.map((v) => <label className="tg" key={v.id}><span><b>{v.code}</b> <small className="mut">{v.name}</small></span>
          <span className="acts"><span className={`pill ${v.maint === 'under' ? 'warning' : 'normal'}`}>{v.maint === 'under' ? 'In maintenance' : 'Normal'}</span><input type="checkbox" aria-label={`Maintenance mode for ${v.code}`} disabled={!can2} checked={v.maint === 'under'} onChange={() => ask(v)} /></span></label>)}
      </div>
      {can2 && <div className="card"><h2>Record maintenance</h2>
        <div className="fg">
          <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, target: '' })}>{Object.entries(MT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label={sensorType ? 'Sensor' : 'Device'} err={err.target}><select value={tgt} onChange={(e) => setF({ ...f, target: e.target.value })}><option value="">Select…</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          {f.type === 'calibration' && <Field label="Result"><select value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option>Pass</option><option>Fail</option></select></Field>}
          <Field label="Notes" cls="full" err={err.notes}><textarea rows="2" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <button className="btn p" onClick={add}>Save record</button>
        {f.type === 'battery' && <small className="mut"> The battery level of the device is reset to 100%.</small>}
      </div>}
      <div className="card"><h2>Maintenance records</h2>
        <DataTable columns={['Date', 'Type', 'Target', 'By', 'Result', 'Notes']} rows={(d.maintLog || []).filter((x) => d.devices.some((v) => v.id === x.targetId) || d.sensors.some((s) => s.id === x.targetId)).map((x) => [fmt(x.t), MT[x.type], x.targetLabel, x.by, x.result || '—', x.notes || '—'])} empty="No maintenance recorded yet." step={15} /></div>
      {cf && <Confirm title="Enable maintenance mode?" ok="Enable" onOk={() => { toggle(cf); setCf(null); say('Maintenance mode on.'); }} onClose={() => setCf(null)}>Alerts for <b>{cf.code}</b> will pause and its pump cannot be started until you end maintenance mode.</Confirm>}
    </>
  );
}

/* ---------- Sync & backup ---------- */
function SynTab({ d, full, update, replace, user, say }) {
  const owner = user.role === 'Owner', can2 = can(user, 'devices'), s = d.sync, file = useRef(null);
  const [pend, setPend] = useState(null), [err, setErr] = useState('');
  const sync = () => update((n) => { n.sync.status = 'pending'; n.sync.pendingAt = now(); n.sync.lastTry = now(); n.sync.by = user.name; });
  const backup = () => {
    const D = new Date(), st = `${D.getFullYear()}${String(D.getMonth() + 1).padStart(2, '0')}${String(D.getDate()).padStart(2, '0')}_${String(D.getHours()).padStart(2, '0')}${String(D.getMinutes()).padStart(2, '0')}`;
    download(new Blob([JSON.stringify({ app: 'aquagrow-sentinel', version: APP_VERSION, schema: 1, exportedAt: D.toISOString(), data: full })], { type: 'application/json' }), `aquagrow_backup_${st}.json`);
    update((n) => { n.sync.lastBackup = now(); }, 'Created database backup', user.name); say('Backup downloaded.');
  };
  const pick = (e) => {
    const fl = e.target.files[0]; e.target.value = ''; setErr('');
    if (!fl) return;
    if (fl.size > 20 * 1024 * 1024) return setErr('That file is too large to be a backup.');
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result), x = o && o.data;
        if (!o || o.app !== 'aquagrow-sentinel' || !x) throw new Error('This is not an AquaGrow Sentinel backup.');
        if (['farms', 'areas', 'devices', 'users'].some((k) => !Array.isArray(x[k]))) throw new Error('The backup is incomplete or damaged.');
        if (!x.users.some((u) => u.role === 'Owner' && u.active !== false)) throw new Error('The backup has no active owner account.');
        setPend({ data: x, at: o.exportedAt, name: fl.name });
      } catch (er) { setErr(er.message || 'The file could not be read.'); }
    };
    r.onerror = () => setErr('The file could not be read.');
    r.readAsText(fl);
  };
  const pill = { successful: 'normal', pending: 'warning', failed: 'critical' }[s.status];
  return (
    <div className="grid c2" style={{ alignItems: 'start' }}>
      <div className="card"><h2>Device synchronization</h2>
        <dl className="kv"><dt>Status</dt><dd><span className={`pill ${pill}`}>{s.status === 'successful' ? 'Successful' : s.status === 'pending' ? 'Pending' : 'Failed'}</span>{s.error && <small className="err"> {s.error}</small>}</dd>
          <dt>Last successful sync</dt><dd>{fmt(s.last)} ({ago(s.last)})</dd><dt>Automatic sync</dt><dd>every {s.intervalMin} min</dd></dl>
        <div className="acts"><button className="btn p" disabled={!can2 || s.status === 'pending'} onClick={sync}>{s.status === 'pending' && <span className="spin" />}Sync now</button>
          {owner && <select className="inp" aria-label="Sync interval" value={s.intervalMin} onChange={(e) => update((n) => { n.sync.intervalMin = +e.target.value; }, `Set sync interval to ${e.target.value} min`, user.name)}>{[1, 5, 15, 30, 60].map((m) => <option key={m} value={m}>Every {m} min</option>)}</select>}</div>
        <p className="mut" style={{ fontSize: 13 }}>A sync succeeds when at least one ESP32 is reachable. With a real backend this would pull stored readings from each device.</p>
      </div>
      {owner && <div className="card"><h2>Backup and restore</h2>
        <dl className="kv"><dt>Last backup</dt><dd>{s.lastBackup ? `${fmt(s.lastBackup)} (${ago(s.lastBackup)})` : 'Never'}</dd></dl>
        <div className="acts"><button className="btn p" onClick={backup}>Download backup</button><input ref={file} type="file" accept="application/json,.json" hidden onChange={pick} /><button className="btn" onClick={() => file.current.click()}>Restore from file…</button></div>
        {err && <div className="err" role="alert" style={{ marginTop: 8 }}>{err}</div>}
        <p className="mut" style={{ fontSize: 13 }}>The backup contains all farms, devices, readings, alerts, logs and user accounts (passwords are stored as hashes). Keep the file private.</p>
      </div>}
      {pend && <Confirm title="Restore this backup?" ok="Replace all data" danger onOk={() => { replace(pend.data, `Restored database from ${pend.name}`, user.name); setPend(null); say('Backup restored.'); }} onClose={() => setPend(null)}>
        All current data will be replaced with the contents of <b>{pend.name}</b>{pend.at && <> (created {new Date(pend.at).toLocaleString()})</>}. This cannot be undone. If your account is not in the backup you will be signed out.</Confirm>}
    </div>
  );
}

export default function SettingsPage({ d, full, update, replace, user }) {
  const owner = user.role === 'Owner', [toast, say] = useToast();
  const tabs = [...(owner ? [['app', 'Application']] : []), ['thr', 'Thresholds & calibration'], ['mnt', 'Maintenance'], ['syn', 'Sync & backup']];
  const [tab, setTab] = useState(tabs[0][0]);
  const P = { d, full, update, replace, user, say };
  return (
    <div className="pg">
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'app' && owner && <AppTab {...P} />}{tab === 'thr' && <ThrTab {...P} />}{tab === 'mnt' && <MntTab {...P} />}{tab === 'syn' && <SynTab {...P} />}
      {toast}
    </div>
  );
}

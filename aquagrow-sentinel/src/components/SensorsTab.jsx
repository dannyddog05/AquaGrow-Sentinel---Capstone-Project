import { useState } from 'react';
import { M, STYPES } from '../data/constants';
import { Modal, Field } from './ui';
import { can, areaStatus, metricsOf, freePins, sensorConn, calibState, ago, now, nextId } from '../data/db';

const CAL = { ok: ['Calibrated', 'normal'], due: ['Due', 'warning'], never: ['Not calibrated', 'offline'], failed: ['Failed', 'critical'] };
const CONN = { connected: 'normal', disconnected: 'critical', offline: 'offline' };

function SensorForm({ d, sensor, onSave, onClose }) {
  const [f, setF] = useState({ type: sensor?.type || 'moisture', dev: sensor?.dev || d.devices[0]?.id || '', pin: sensor ? String(sensor.pin) : '', area: sensor?.area || '' });
  const [err, setErr] = useState({});
  const pins = freePins(d, f.dev, f.type, sensor?.id);
  const pin = pins.includes(Number(f.pin)) ? f.pin : '';
  const areas = d.areas.filter((a) => a.dev === f.dev);
  const area = areas.some((a) => a.id === f.area) ? f.area : '';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const x = {};
    if (!f.dev) x.dev = 'Select an ESP32 device.';
    if (!pin) x.pin = pins.length ? 'Select a GPIO pin.' : `No free ${STYPES[f.type].pin} pins on this device.`;
    if (area && d.sensors.some((s) => s.id !== sensor?.id && s.area === area && s.type === f.type)) x.area = `This area already has a ${M[f.type].n.toLowerCase()} sensor.`;
    setErr(x);
    if (!Object.keys(x).length) onSave({ id: sensor?.id, type: f.type, dev: f.dev, pin: Number(pin), area: area || null });
  };
  return (
    <Modal title={sensor ? `Edit ${sensor.id}` : 'Register sensor'} onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={submit}>{sensor ? 'Save changes' : 'Register sensor'}</button></>}>
      <div className="fg">
        <Field label="Sensor type" cls="full"><select value={f.type} onChange={set('type')}>{Object.entries(STYPES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select></Field>
        <Field label="ESP32 device" err={err.dev}><select value={f.dev} onChange={set('dev')}>{d.devices.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}</select></Field>
        <Field label={`GPIO pin (${STYPES[f.type].pin})`} err={err.pin}>
          <select value={pin} onChange={set('pin')}><option value="">Select pin</option>{pins.map((p) => <option key={p} value={p}>GPIO{p}</option>)}</select>
        </Field>
        <Field label="Monitoring area" err={err.area} cls="full">
          <select value={area} onChange={set('area')}><option value="">Not assigned</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <small className="mut">Only areas assigned to the selected ESP32 are listed.</small>
        </Field>
      </div>
    </Modal>
  );
}

export function CalForm({ s, onSave, onClose }) {
  const [res, setRes] = useState('Pass'), [note, setNote] = useState('');
  return (
    <Modal title={`Record calibration · ${s.id}`} onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={() => onSave({ t: now(), result: res, note: note.trim() })}>Save record</button></>}>
      <div className="fg">
        <Field label="Result"><select value={res} onChange={(e) => setRes(e.target.value)}><option>Pass</option><option>Fail</option></select></Field>
        <Field label="Date"><input value={new Date().toLocaleDateString()} disabled /></Field>
        <Field label="Notes (optional)" cls="full"><textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export default function SensorsTab({ d, update, user, say }) {
  const canEdit = can(user, 'devices'), canDel = user.role === 'Owner';
  const [mod, setMod] = useState(null);
  const close = () => setMod(null);
  const link = (n, sid) => { // keep the area's sensor list in sync
    const s = n.sensors.find((x) => x.id === sid), a = n.areas.find((x) => x.id === s.area);
    if (a && !metricsOf(a).includes(s.type)) a.metrics = [...metricsOf(a), s.type];
  };
  const save = (x) => {
    let sid = x.id;
    update((n) => {
      if (x.id) Object.assign(n.sensors.find((s) => s.id === x.id), x);
      else { sid = nextId(n.sensors, 'S-', 'id'); const v = n.devices.find((q) => q.id === x.dev); n.sensors.push({ ...x, id: sid, fault: false, last: v && v.status === 'online' ? now() : null, calib: null }); }
      link(n, sid);
    }, `${x.id ? 'Edited' : 'Registered'} sensor ${sid || ''}`.trim(), user.name);
    close(); say(x.id ? 'Sensor updated.' : 'Sensor registered.');
  };
  const calibrate = (c) => { update((n) => { n.sensors.find((s) => s.id === mod.s.id).calib = c; }, `Recorded calibration (${c.result}) for ${mod.s.id}`, user.name); close(); say('Calibration recorded.'); };
  const remove = () => { update((n) => { n.sensors = n.sensors.filter((s) => s.id !== mod.s.id); }, `Deleted sensor ${mod.s.id}`, user.name); close(); say('Sensor deleted.'); };
  const fault = (s) => update((n) => {
    const t = n.sensors.find((x) => x.id === s.id); t.fault = !t.fault; t.since = now();
  }, `Demo: toggled fault on ${s.id}`, user.name);

  return (
    <>
      <div className="grid cA">
        {Object.entries(STYPES).map(([k, t]) => (
          <div className="card" key={k} style={{ padding: 14 }}><b className="f">{t.name}</b>
            <div className="mut" style={{ fontSize: 13 }}>{t.pin} input · {d.sensors.filter((s) => s.type === k).length} registered</div></div>
        ))}
      </div>
      <div className="card">
        <h2>Registered sensors {canEdit && <button className="btn p sm" onClick={() => setMod({ t: 'form' })}>+ Register sensor</button>}</h2>
        <div className="tw"><table className="tbl">
          <thead><tr><th>Sensor</th><th>Type</th><th>ESP32 · Pin</th><th>Area</th><th>Connection</th><th>Reading</th><th>Calibration</th><th>Last reading</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {d.sensors.length === 0 && <tr><td colSpan="9" className="mut">No sensors registered.</td></tr>}
            {d.sensors.map((s) => {
              const dv = d.devices.find((v) => v.id === s.dev), a = d.areas.find((x) => x.id === s.area), cn = sensorConn(d, s), cs = calibState(s);
              const live = cn === 'connected' && a ? a.r[s.type] : null;
              return (
                <tr key={s.id}>
                  <td><b className="f">{s.id}</b></td><td>{M[s.type].n}</td><td>{dv?.code} · GPIO{s.pin}</td><td>{a ? a.name : <span className="mut">Not assigned</span>}</td>
                  <td><span className={`pill ${CONN[cn]}`}>{cn}</span></td><td>{live != null ? `${live}${M[s.type].u}` : '—'}</td>
                  <td><span className={`pill ${CAL[cs][1]}`} title={s.calib ? new Date(s.calib.t).toLocaleDateString() : ''}>{CAL[cs][0]}</span></td>
                  <td>{ago(s.last)}</td>
                  {canEdit && <td><div className="acts" style={{ flexWrap: 'nowrap' }}>
                    <button className="btn sm" onClick={() => setMod({ t: 'form', s })}>Edit</button>
                    <button className="btn sm" onClick={() => setMod({ t: 'cal', s })}>Calibrate</button>
                    <button className="btn sm" title="Demo: simulate a wiring fault" onClick={() => fault(s)}>{s.fault ? 'Reconnect' : 'Fault'}</button>
                    {canDel && <button className="btn sm d" onClick={() => setMod({ t: 'del', s })}>Delete</button>}
                  </div></td>}
                </tr>
              );
            })}
          </tbody></table></div>
      </div>
      {mod?.t === 'form' && <SensorForm d={d} sensor={mod.s} onSave={save} onClose={close} />}
      {mod?.t === 'cal' && <CalForm s={mod.s} onSave={calibrate} onClose={close} />}
      {mod?.t === 'del' && (
        <Modal title="Delete sensor?" onClose={close} foot={<><button className="btn" onClick={close}>Cancel</button><button className="btn p" style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={remove}>Delete</button></>}>
          <p>{mod.s.id} will be removed and its GPIO pin freed.</p>
        </Modal>
      )}
    </>
  );
}

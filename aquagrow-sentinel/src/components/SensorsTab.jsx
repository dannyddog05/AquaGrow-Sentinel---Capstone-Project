import { useState } from 'react';
import { M, STYPES } from '../data/constants';
import { BTN, BTN_CRIT, BTN_P, BTN_SM, BTN_SM_D, BTN_SM_P, CARD, CARD_H2, Field, Modal, pill } from './ui';
import { can, metricsOf, freePins, sensorConn, calibState, ago, now, nextId } from '../data/db';

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
      foot={<><button className={BTN} onClick={onClose}>Cancel</button><button className={BTN_P} onClick={submit}>{sensor ? 'Save changes' : 'Register sensor'}</button></>}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Sensor type" cls="full"><select value={f.type} onChange={set('type')}>{Object.entries(STYPES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select></Field>
        <Field label="ESP32 device" err={err.dev}><select value={f.dev} onChange={set('dev')}>{d.devices.map((v) => <option key={v.id} value={v.id}>{v.code}</option>)}</select></Field>
        <Field label={`GPIO pin (${STYPES[f.type].pin})`} err={err.pin}>
          <select value={pin} onChange={set('pin')}><option value="">Select pin</option>{pins.map((p) => <option key={p} value={p}>GPIO{p}</option>)}</select>
        </Field>
        <Field label="Monitoring area" err={err.area} cls="full">
          <select value={area} onChange={set('area')}><option value="">Not assigned</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <small className="text-mut font-normal">Only areas assigned to the selected ESP32 are listed.</small>
        </Field>
      </div>
    </Modal>
  );
}

export function CalForm({ s, onSave, onClose }) {
  const [res, setRes] = useState('Pass'), [note, setNote] = useState('');
  return (
    <Modal title={`Record calibration · ${s.id}`} onClose={onClose}
      foot={<><button className={BTN} onClick={onClose}>Cancel</button><button className={BTN_P} onClick={() => onSave({ t: now(), result: res, note: note.trim() })}>Save record</button></>}>
      <div className="grid grid-cols-2 gap-x-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
        {Object.entries(STYPES).map(([k, t]) => (
          <div className={`${CARD} p-3.5`} key={k}>
            <b className="font-display">{t.name}</b>
            <div className="text-mut text-[13px]">{t.pin} input · {d.sensors.filter((s) => s.type === k).length} registered</div>
          </div>
        ))}
      </div>
      <div className={CARD}>
        <h2 className={CARD_H2}>Registered sensors {canEdit && <button className={BTN_SM_P} onClick={() => setMod({ t: 'form' })}>+ Register sensor</button>}</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px] min-w-[760px]">
            <thead>
              <tr>
                {['Sensor', 'Type', 'ESP32 · Pin', 'Area', 'Connection', 'Reading', 'Calibration', 'Last reading'].map((h) => (
                  <th key={h} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                ))}
                {canEdit && <th className="p-2 border-b-2 border-line" />}
              </tr>
            </thead>
            <tbody>
              {d.sensors.length === 0 && <tr><td colSpan="9" className="text-mut py-2.5 px-2 border-b border-line">No sensors registered.</td></tr>}
              {d.sensors.map((s) => {
                const dv = d.devices.find((v) => v.id === s.dev), a = d.areas.find((x) => x.id === s.area), cn = sensorConn(d, s), cs = calibState(s);
                const live = cn === 'connected' && a ? a.r[s.type] : null;
                return (
                  <tr key={s.id}>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><b className="font-display">{s.id}</b></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{M[s.type].n}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{dv?.code} · GPIO{s.pin}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{a ? a.name : <span className="text-mut">Not assigned</span>}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><span className={pill(CONN[cn])}>{cn}</span></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{live != null ? `${live}${M[s.type].u}` : '—'}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><span className={pill(CAL[cs][1])} title={s.calib ? new Date(s.calib.t).toLocaleDateString() : ''}>{CAL[cs][0]}</span></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{ago(s.last)}</td>
                    {canEdit && (
                      <td className="py-[9px] px-2 border-b border-line align-middle">
                        <div className="flex gap-1.5 flex-nowrap">
                          <button className={BTN_SM} onClick={() => setMod({ t: 'form', s })}>Edit</button>
                          <button className={BTN_SM} onClick={() => setMod({ t: 'cal', s })}>Calibrate</button>
                          <button className={BTN_SM} title="Demo: simulate a wiring fault" onClick={() => fault(s)}>{s.fault ? 'Reconnect' : 'Fault'}</button>
                          {canDel && <button className={BTN_SM_D} onClick={() => setMod({ t: 'del', s })}>Delete</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {mod?.t === 'form' && <SensorForm d={d} sensor={mod.s} onSave={save} onClose={close} />}
      {mod?.t === 'cal' && <CalForm s={mod.s} onSave={calibrate} onClose={close} />}
      {mod?.t === 'del' && (
        <Modal title="Delete sensor?" onClose={close} foot={<><button className={BTN} onClick={close}>Cancel</button><button className={BTN_CRIT} onClick={remove}>Delete</button></>}>
          <p>{mod.s.id} will be removed and its GPIO pin freed.</p>
        </Modal>
      )}
    </>
  );
}

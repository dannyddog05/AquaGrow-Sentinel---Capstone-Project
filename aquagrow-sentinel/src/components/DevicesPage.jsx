import { useState } from 'react';
import { BOARDS, DEFB, LATEST_FW, STYPES } from '../data/constants';
import { Modal, Field, StatusDot, accent } from './ui';
import SensorsTab from './SensorsTab';
import PinMap from './PinMap';
import { can, ago, now, fmtDur, rssiLabel, battVolt, nextId, boardOf, sensorConn } from '../data/db';

const MAINT = { ok: ['Operational', 'normal'], due: ['Service due', 'warning'], under: ['Under maintenance', 'offline'] };
const batt = (v) => (v.battery == null ? 'Mains powered' : `${Math.round(v.battery)}% · ${battVolt(v.battery)} V`);
const wifi = (v) => (v.rssi == null || v.status !== 'online' ? '—' : `${v.rssi} dBm · ${rssiLabel(v.rssi)}`);
const upt = (v) => (v.status === 'online' && v.boot ? fmtDur(now() - v.boot) : '—');
const Fact = ({ k, children }) => <div><small>{k}</small>{children}</div>;

function DeviceForm({ d, dev, onSave, onClose }) {
  const [f, setF] = useState({ code: dev?.code || nextId(d.devices, 'ESP32-', 'code'), name: dev?.name || '', mac: dev?.mac || '', board: dev?.board || DEFB, power: dev ? (dev.battery == null ? 'mains' : 'battery') : 'battery' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const x = {}, code = f.code.trim().toUpperCase(), mac = f.mac.trim().toUpperCase();
    if (!/^ESP32-\d{3}$/.test(code)) x.code = 'Use the format ESP32-001.';
    else if (d.devices.some((v) => v.id !== dev?.id && v.code === code)) x.code = 'This device ID is already registered.';
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) x.mac = 'Use the format 24:6F:28:AA:BB:CC.';
    else if (d.devices.some((v) => v.id !== dev?.id && v.mac === mac)) x.mac = 'This MAC address is already registered.';
    if (!f.name.trim()) x.name = 'Give the device a name.';
    setErr(x);
    if (!Object.keys(x).length) onSave({ id: dev?.id, code, mac, name: f.name.trim(), board: f.board, power: f.power });
  };
  return (
    <Modal title={dev ? `Edit ${dev.code}` : 'Register ESP32 device'} onClose={onClose}
      foot={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={submit}>{dev ? 'Save changes' : 'Register device'}</button></>}>
      <div className="fg">
        <Field label="Device ID" err={err.code}><input autoFocus value={f.code} onChange={set('code')} disabled={!!dev} /></Field>
        <Field label="Device name" err={err.name}><input value={f.name} onChange={set('name')} /></Field>
        <Field label="MAC address" err={err.mac}><input value={f.mac} onChange={set('mac')} placeholder="24:6F:28:AA:BB:CC" /></Field>
        <Field label="Power source"><select value={f.power} onChange={set('power')}><option value="battery">Battery</option><option value="mains">Mains powered</option></select></Field>
        <Field label="Board" cls="full"><select value={f.board} onChange={set('board')}>{Object.keys(BOARDS).map((b) => <option key={b}>{b}</option>)}</select>
          <small className="mut">The board decides which GPIO pins are available for sensors.</small></Field>
      </div>
    </Modal>
  );
}

function DeviceView({ d, dev, canEdit, update, user, say, onClose }) {
  const ss = d.sensors.filter((s) => s.dev === dev.id), ar = d.areas.filter((a) => a.dev === dev.id), on = dev.status === 'online';
  const toggle = () => { update((n) => {
    const v = n.devices.find((x) => x.id === dev.id), up = v.status === 'online';
    v.status = up ? 'offline' : 'online'; v.drop = null; v.since = now();
    if (!up) { v.boot = now(); v.seen = now(); v.rssi = v.rssi ?? -62; if (!v.fw || v.fw === '—') v.fw = '1.0.0'; }
  }, `Demo: ${on ? 'disconnected' : 'connected'} ${dev.code}`, user.name); say(on ? 'Device set offline (demo).' : 'Device set online (demo).'); };
  const setMaint = (m) => { update((n) => { n.devices.find((x) => x.id === dev.id).maint = m; }, `Set ${dev.code} maintenance status to ${MAINT[m][0]}`, user.name); say('Maintenance status updated.'); };
  const b = boardOf(dev), total = b.analog.length + b.digital.length;
  return (
    <Modal title={`${dev.code} · ${dev.name}`} onClose={onClose} foot={<button className="btn" onClick={onClose}>Close</button>}>
      <div className="facts">
        <Fact k="Status"><StatusDot s={dev.status} /></Fact>
        <Fact k="Last communication">{ago(dev.seen)}</Fact>
        <Fact k="Battery">{batt(dev)}</Fact><Fact k="Wi-Fi signal">{wifi(dev)}</Fact>
        <Fact k="Firmware">{dev.fw || '—'}{dev.fw && dev.fw !== LATEST_FW && ` (latest ${LATEST_FW})`}</Fact><Fact k="Uptime">{upt(dev)}</Fact>
        <Fact k="MAC address">{dev.mac}</Fact><Fact k="Board">{dev.board}</Fact>
        <Fact k="Pins used">{ss.length} of {total}</Fact>
        <Fact k="Assigned areas">{ar.length ? ar.map((a) => a.name).join(', ') : 'None'}</Fact>
        <Fact k="Maintenance">
          {canEdit ? <select className="inp" aria-label="Maintenance status" value={dev.maint} onChange={(e) => setMaint(e.target.value)}>{Object.entries(MAINT).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select> : MAINT[dev.maint][0]}
        </Fact>
        {canEdit && <Fact k="Device API key"><span className="key">{dev.key}</span></Fact>}
      </div>
      <b className="f">Sensors on this device</b>
      {ss.length === 0 ? <p className="mut">No sensors registered.</p> : (
        <div className="tw"><table className="tbl" style={{ minWidth: 0 }}><tbody>{ss.map((s) => (
          <tr key={s.id}><td><b>{s.id}</b></td><td>{STYPES[s.type].name}</td><td>GPIO{s.pin}</td><td><span className={`pill ${sensorConn(d, s) === 'connected' ? 'normal' : sensorConn(d, s) === 'offline' ? 'offline' : 'critical'}`}>{sensorConn(d, s)}</span></td></tr>
        ))}</tbody></table></div>
      )}
      {canEdit && <p className="mut" style={{ fontSize: 13 }}>Demo control: <button className="btn sm" onClick={toggle}>{on ? 'Simulate disconnect' : 'Simulate connect'}</button> (replaces the real ESP32 until hardware is connected)</p>}
    </Modal>
  );
}

export default function DevicesPage({ d, update, user }) {
  const canEdit = can(user, 'devices'), canDel = user.role === 'Owner';
  const [tab, setTab] = useState('dev'), [mod, setMod] = useState(null), [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const close = () => setMod(null);
  const cnt = (s) => d.devices.filter((v) => v.status === s).length;

  const save = (x) => {
    update((n) => {
      if (x.id) { const v = n.devices.find((q) => q.id === x.id); Object.assign(v, { name: x.name, mac: x.mac, board: x.board }); if (x.power === 'mains') v.battery = null; else if (v.battery == null) v.battery = 100; }
      else n.devices.push({ id: 'd' + now(), code: x.code, name: x.name, mac: x.mac, board: x.board, status: 'disconnected', seen: null, battery: x.power === 'mains' ? null : 100, rssi: null, fw: '—', boot: null, maint: 'ok', key: Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, '0')).join('') });
    }, `${x.id ? 'Edited' : 'Registered'} device ${x.code}`, user.name);
    close(); say(x.id ? 'Device updated.' : 'Device registered. It shows as disconnected until it sends its first data.');
  };
  const remove = () => {
    const v = mod.dev;
    update((n) => { n.devices = n.devices.filter((x) => x.id !== v.id); n.sensors = n.sensors.filter((s) => s.dev !== v.id); n.areas.forEach((a) => { if (a.dev === v.id) a.dev = null; }); }, `Deleted device ${v.code}`, user.name);
    close(); say('Device deleted.');
  };

  const Stat = ({ n, l }) => <div className="card stat"><div className="n">{n}</div><div className="l">{l}</div></div>;
  return (
    <div className="pg">
      <div className="bar2">
        <div className="tabs" role="tablist">
          {[['dev', 'Devices'], ['sen', 'Sensors'], ['pin', 'Pin map']].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {canEdit && tab === 'dev' && <button className="btn p" onClick={() => setMod({ t: 'form' })}>+ Register device</button>}
      </div>

      {tab === 'dev' && <>
        <div className="grid s5">
          <Stat n={cnt('online')} l="Online" /><Stat n={cnt('offline')} l="Offline" /><Stat n={cnt('disconnected')} l="Disconnected" />
          <Stat n={d.devices.filter((v) => v.maint !== 'ok').length} l="Need maintenance" /><Stat n={d.devices.filter((v) => v.battery != null && v.battery < 20).length} l="Low battery (<20%)" />
        </div>
        <div className="grid cA">
          {d.devices.map((v) => {
            const ar = d.areas.filter((a) => a.dev === v.id);
            return (
              <div className={`card ${accent(v.status)}`} key={v.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div><b className="f">{v.code}</b><div className="mut" style={{ fontSize: 12 }}>{v.name}</div></div><StatusDot s={v.status} />
                </div>
                <div className="facts">
                  <Fact k="Last seen">{ago(v.seen)}</Fact><Fact k="Uptime">{upt(v)}</Fact>
                  <Fact k="Battery"><span style={{ color: v.battery != null && v.battery < 20 ? 'var(--crit)' : 'inherit', fontWeight: 600 }}>{batt(v)}</span></Fact>
                  <Fact k="Wi-Fi">{wifi(v)}</Fact>
                  <Fact k="Firmware">{v.fw || '—'} {v.fw && v.fw !== '—' && v.fw !== LATEST_FW && <span className="pill warning">update</span>}</Fact>
                  <Fact k="Maintenance"><StatusDot s={{ ok: 'normal', due: 'warning', under: 'maintenance' }[v.maint]} label={MAINT[v.maint][0]} /></Fact>
                  <Fact k="Areas">{ar.length ? ar.map((a) => a.name).join(', ') : 'None'}</Fact>
                </div>
                <div className="acts">
                  <button className="btn sm" onClick={() => setMod({ t: 'view', id: v.id })}>Details</button>
                  {canEdit && <button className="btn sm" onClick={() => setMod({ t: 'form', dev: v })}>Edit</button>}
                  {canDel && <button className="btn sm d" onClick={() => setMod({ t: 'del', dev: v })}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      </>}
      {tab === 'sen' && <SensorsTab d={d} update={update} user={user} say={say} />}
      {tab === 'pin' && <PinMap d={d} />}

      {mod?.t === 'form' && <DeviceForm d={d} dev={mod.dev} onSave={save} onClose={close} />}
      {mod?.t === 'view' && d.devices.find((v) => v.id === mod.id) && <DeviceView d={d} dev={d.devices.find((v) => v.id === mod.id)} canEdit={canEdit} update={update} user={user} say={say} onClose={close} />}
      {mod?.t === 'del' && (
        <Modal title="Delete device?" onClose={close} foot={<><button className="btn" onClick={close}>Cancel</button><button className="btn p" style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={remove}>Delete</button></>}>
          <p>{mod.dev.code} and its {d.sensors.filter((s) => s.dev === mod.dev.id).length} sensor(s) will be removed. Areas using it become unassigned.</p>
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

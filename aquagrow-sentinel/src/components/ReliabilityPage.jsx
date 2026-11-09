import { useState } from 'react';
import { M, STYPES } from '../data/constants';
import { ago, can } from '../data/db';
import { canBuffer, genKey, dropWifi, testPacket, VALID, SPIKE, STALE_MS } from '../data/ingest';
import { Confirm, DataTable, useToast } from './ui';

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const conn = (v) => (v.status === 'online' ? ['Online', 'normal'] : v.drop ? [`Reconnecting (attempt ${v.drop.attempts})`, 'warning'] : [v.status === 'disconnected' ? 'Disconnected' : 'Offline', v.status]);
const Stat = ({ n, l, c }) => <div className="card stat"><div className="n" style={{ color: c }}>{n}</div><div className="l">{l}</div></div>;

export default function ReliabilityPage({ d, update, user }) {
  const canDev = can(user, 'devices'), owner = user.role === 'Owner', I = d.ingest, [toast, say] = useToast();
  const [sid, setSid] = useState(''), [did, setDid] = useState(''), [cf, setCf] = useState(null);
  const sensor = d.sensors.find((s) => s.id === sid) || d.sensors.find((s) => s.area) || d.sensors[0], dev = d.devices.find((v) => v.id === did && v.status === 'online') || d.devices.find((v) => v.status === 'online');
  const send = (kind) => {
    let res;
    update((n) => { res = testPacket(n, kind, n.sensors.find((s) => s.id === sensor.id) || sensor); }, `Demo: sent a ${kind} test packet from ${sensor.id}`, user.name);
    say(res ? (res.ok ? 'Accepted. Large jumps are stored but flagged.' : `Rejected: ${res.reason}`) : 'Sent.');
  };
  const drop = () => { update((n) => { dropWifi(n, dev.id); }, `Demo: Wi-Fi dropped on ${dev.code}`, user.name); say(`${dev.code} lost Wi-Fi. Watch it reconnect.`); };
  const edit = (v, fn, msg) => update((n) => fn(n.devices.find((x) => x.id === v.id)), msg, user.name);
  const rotate = () => { const v = cf; edit(v, (x) => { x.devKey = x.devKey || x.key; x.key = genKey(); }, `Rotated the device key of ${v.code}`); setCf(null); say('New key created. The device must be provisioned before its data is accepted again.'); };

  return (
    <div className="pg">
      <div className="grid s5">
        <Stat n={I.stats.accepted.toLocaleString()} l="Readings accepted" c="var(--gd)" /><Stat n={I.stats.invalid} l="Invalid values rejected" /><Stat n={I.stats.duplicate} l="Duplicates blocked" />
        <Stat n={I.stats.unauthorized} l="Unauthenticated packets blocked" /><Stat n={I.stats.backfilled} l="Stored readings synchronized" />
      </div>

      <div className="card"><h2>Devices</h2>
        <div className="tw"><table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Device</th><th>Connection</th><th>Last seen</th><th>Stored on device</th><th>Authentication</th><th>Auto reconnect</th><th></th></tr></thead>
          <tbody>{d.devices.map((v) => {
            const [c, cls] = conn(v), stale = v.devKey && v.devKey !== v.key;
            return (
              <tr key={v.id}>
                <td><b className="f">{v.code}</b><div className="mut" style={{ fontSize: 12 }}>fw {v.fw || '—'}</div></td>
                <td><span className={`pill ${cls}`}>{c}</span></td><td>{v.seen ? ago(v.seen) : 'never'}</td>
                <td>{canBuffer(v) ? <>{(v.buffer || []).length} readings{v.lastFlush && <div className="mut" style={{ fontSize: 12 }}>Last sync: {v.lastFlush.count} readings, {ago(v.lastFlush.t)}</div>}</> : <span className="mut">Not supported (needs firmware 1.2.0)</span>}</td>
                <td><span className="key">••••{v.key.slice(-4)}</span> {stale ? <span className="pill critical">Device key out of date</span> : <span className="pill normal">Key valid</span>}</td>
                <td><input type="checkbox" aria-label={`Automatic reconnection for ${v.code}`} disabled={!canDev} checked={v.autoReconnect !== false} onChange={(e) => edit(v, (x) => { x.autoReconnect = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} automatic reconnection for ${v.code}`)} /></td>
                <td><div className="acts" style={{ flexWrap: 'nowrap' }}>
                  {stale && canDev && <button className="btn sm p" onClick={() => { edit(v, (x) => { x.devKey = x.key; }, `Provisioned the current key to ${v.code}`); say('Key provisioned to the device.'); }}>Provision key</button>}
                  {owner && <button className="btn sm" onClick={() => setCf(v)}>Rotate key</button>}
                  {v.drop && canDev && <button className="btn sm" onClick={() => { edit(v, (x) => { x.drop.retryAt = 0; }, `Forced a reconnect attempt on ${v.code}`); }}>Retry now</button>}
                </div></td>
              </tr>);
          })}</tbody></table></div>
      </div>

      <div className="card"><h2>Sensor data status</h2>
        <div className="tw"><table className="tbl" style={{ minWidth: 820 }}>
          <thead><tr><th>Sensor</th><th>ESP32 · Area</th><th>Last reading</th><th>Value</th><th>Data</th><th>Rejected</th></tr></thead>
          <tbody>{d.sensors.map((s) => {
            const v = d.devices.find((x) => x.id === s.dev), a = d.areas.find((x) => x.id === s.area), age = s.last ? Date.now() - s.last : null;
            const st = !v || v.status !== 'online' ? ['Device offline', 'offline'] : s.fault ? ['Disconnected', 'critical'] : age != null && age > STALE_MS ? ['No recent data', 'warning'] : ['Receiving', 'normal'];
            return <tr key={s.id}><td><b>{s.id}</b> <small className="mut">{STYPES[s.type].name}</small></td><td>{v?.code} · {a?.name || 'Not assigned'}</td><td>{s.last ? `${fmt(s.last)} (${ago(s.last)})` : 'never'}</td>
              <td>{a && a.r[s.type] != null ? `${a.r[s.type]}${M[s.type].u}` : '—'}</td><td><span className={`pill ${st[1]}`}>{st[0]}</span></td><td>{s.rej || 0}</td></tr>;
          })}</tbody></table></div>
      </div>

      <div className="grid c2" style={{ alignItems: 'start' }}>
        <div className="card"><h2>Rejected and flagged readings</h2>
          <DataTable columns={['Time', 'Device · Sensor', 'Area', 'Value', 'Result', 'Reason']} rows={I.log.map((l) => [fmt(l.t), `${l.dev} · ${l.sensor}`, l.area, String(l.value), <span className={`pill ${l.result === 'Rejected' ? 'critical' : 'warning'}`}>{l.result}</span>, <span title={l.detail}>{l.reason}</span>])} empty="Nothing rejected yet. Use the test tools to try it." step={15} />
        </div>
        <div className="grid">
          <div className="card"><h2>Validation rules</h2>
            <ul className="pl" style={{ marginTop: 0 }}>
              <li>Only devices with a valid key are accepted.</li><li>The same reading is never stored twice.</li><li>Values must be numbers within the possible range, with a sensible timestamp.</li>
              <li>A jump larger than the limit is stored but flagged.</li><li>An online device whose sensor is silent for {STALE_MS / 1000} s raises a missing-data alert.</li>
              <li>Offline devices keep trying to reconnect. Firmware 1.2.0+ stores readings and sends them when back online.</li>
            </ul>
            <div className="tw"><table className="tbl" style={{ minWidth: 0 }}><thead><tr><th>Sensor</th><th>Possible range</th><th>Largest jump</th></tr></thead>
              <tbody>{Object.keys(M).map((m) => <tr key={m}><td>{M[m].n}</td><td>{VALID[m][0]} to {VALID[m][1]}{M[m].u}</td><td>{SPIKE[m]}{M[m].u}</td></tr>)}</tbody></table></div>
          </div>
          {canDev && <div className="card"><h2>Test tools</h2>
            <p className="mut" style={{ marginTop: 0, fontSize: 13 }}>Pretend to be an ESP32 and watch how the system reacts.</p>
            <label className="fld">Sensor<select value={sensor?.id || ''} onChange={(e) => setSid(e.target.value)}>{d.sensors.filter((s) => s.area).map((s) => <option key={s.id} value={s.id}>{s.id} · {M[s.type].n} · {d.areas.find((a) => a.id === s.area)?.name}</option>)}</select></label>
            <div className="acts" style={{ marginBottom: 12 }}>
              {[['invalid', 'Invalid value'], ['duplicate', 'Duplicate'], ['spike', 'Sudden jump'], ['badkey', 'Wrong device key']].map(([k, l]) => <button key={k} className="btn sm" disabled={!sensor} onClick={() => send(k)}>{l}</button>)}
            </div>
            <label className="fld">Device<select value={dev?.id || ''} onChange={(e) => setDid(e.target.value)}>{d.devices.filter((v) => v.status === 'online').map((v) => <option key={v.id} value={v.id}>{v.code} · {canBuffer(v) ? 'stores data offline' : 'no offline storage'}</option>)}</select></label>
            <button className="btn sm" disabled={!dev} onClick={drop}>Drop Wi-Fi</button>
          </div>}
        </div>
      </div>
      {cf && <Confirm title="Rotate device key?" ok="Rotate key" danger onOk={rotate} onClose={() => setCf(null)}>A new key is created for <b>{cf.code}</b>. The device keeps using its old key, so its data is rejected until you provision the new key.</Confirm>}
      {toast}
    </div>
  );
}

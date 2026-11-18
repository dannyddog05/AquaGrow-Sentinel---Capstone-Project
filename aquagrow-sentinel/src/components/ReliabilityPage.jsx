import { useState } from 'react';
import { M, STYPES } from '../data/constants';
import { ago, can } from '../data/db';
import { canBuffer, genKey, dropWifi, testPacket, VALID, SPIKE, STALE_MS } from '../data/ingest';
import { ACTS, BTN_SM, BTN_SM_P, CARD, CARD_H2, Confirm, DataTable, Field, KEY_CODE, PG, StatCard, StatStrip, StatusBadge, useToast } from './ui';

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const conn = (v) => (v.status === 'online' ? ['Online', 'normal'] : v.drop ? [`Reconnecting (attempt ${v.drop.attempts})`, 'warning'] : [v.status === 'disconnected' ? 'Disconnected' : 'Offline', v.status]);

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
    <div className={PG}>
      <StatStrip>
        <StatCard value={I.stats.accepted.toLocaleString()} label="Readings accepted" valueClassName="text-brand-dark" /><StatCard value={I.stats.invalid} label="Invalid values rejected" /><StatCard value={I.stats.duplicate} label="Duplicates blocked" />
        <StatCard value={I.stats.unauthorized} label="Unauthenticated packets blocked" /><StatCard value={I.stats.backfilled} label="Stored readings synchronized" />
      </StatStrip>

      <div className={CARD}>
        <h2 className={CARD_H2}>Devices</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px] min-w-[900px]">
            <thead>
              <tr>
                {['Device', 'Connection', 'Last seen', 'Stored on device', 'Authentication', 'Auto reconnect', ''].map((h, i) => (
                  <th key={i} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.devices.map((v) => {
                const [c, cls] = conn(v), stale = v.devKey && v.devKey !== v.key;
                return (
                  <tr key={v.id}>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><b className="font-display">{v.code}</b><div className="text-mut text-[12px]">fw {v.fw || '—'}</div></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><StatusBadge status={cls}>{c}</StatusBadge></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{v.seen ? ago(v.seen) : 'never'}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">
                      {canBuffer(v) ? (
                        <>
                          {(v.buffer || []).length} readings
                          {v.lastFlush && <div className="text-mut text-[12px]">Last sync: {v.lastFlush.count} readings, {ago(v.lastFlush.t)}</div>}
                        </>
                      ) : (
                        <span className="text-mut">Not supported (needs firmware 1.2.0)</span>
                      )}
                    </td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">
                      <span className={KEY_CODE}>••••{v.key.slice(-4)}</span>{' '}
                      {stale ? <StatusBadge status="critical">Device key out of date</StatusBadge> : <StatusBadge status="normal">Key valid</StatusBadge>}
                    </td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">
                      <input type="checkbox" aria-label={`Automatic reconnection for ${v.code}`} disabled={!canDev} checked={v.autoReconnect !== false} onChange={(e) => edit(v, (x) => { x.autoReconnect = e.target.checked; }, `${e.target.checked ? 'Enabled' : 'Disabled'} automatic reconnection for ${v.code}`)} />
                    </td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">
                      <div className="flex gap-1.5 flex-nowrap">
                        {stale && canDev && <button className={BTN_SM_P} onClick={() => { edit(v, (x) => { x.devKey = x.key; }, `Provisioned the current key to ${v.code}`); say('Key provisioned to the device.'); }}>Provision key</button>}
                        {owner && <button className={BTN_SM} onClick={() => setCf(v)}>Rotate key</button>}
                        {v.drop && canDev && <button className={BTN_SM} onClick={() => { edit(v, (x) => { x.drop.retryAt = 0; }, `Forced a reconnect attempt on ${v.code}`); }}>Retry now</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={CARD}>
        <h2 className={CARD_H2}>Sensor data status</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px] min-w-[820px]">
            <thead>
              <tr>
                {['Sensor', 'ESP32 · Area', 'Last reading', 'Value', 'Data', 'Rejected'].map((h) => (
                  <th key={h} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.sensors.map((s) => {
                const v = d.devices.find((x) => x.id === s.dev), a = d.areas.find((x) => x.id === s.area), age = s.last ? Date.now() - s.last : null;
                const st = !v || v.status !== 'online' ? ['Device offline', 'offline'] : s.fault ? ['Disconnected', 'critical'] : age != null && age > STALE_MS ? ['No recent data', 'warning'] : ['Receiving', 'normal'];
                return (
                  <tr key={s.id}>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><b>{s.id}</b> <small className="text-mut">{STYPES[s.type].name}</small></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{v?.code} · {a?.name || 'Not assigned'}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{s.last ? `${fmt(s.last)} (${ago(s.last)})` : 'never'}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{a && a.r[s.type] != null ? `${a.r[s.type]}${M[s.type].u}` : '—'}</td>
                    <td className="py-[9px] px-2 border-b border-line align-middle"><StatusBadge status={st[1]}>{st[0]}</StatusBadge></td>
                    <td className="py-[9px] px-2 border-b border-line align-middle">{s.rej || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-3.5 items-start">
        <div className={CARD}>
          <h2 className={CARD_H2}>Rejected and flagged readings</h2>
          <DataTable columns={['Time', 'Device · Sensor', 'Area', 'Value', 'Result', 'Reason']} rows={I.log.map((l) => [fmt(l.t), `${l.dev} · ${l.sensor}`, l.area, String(l.value), <StatusBadge status={l.result === 'Rejected' ? 'critical' : 'warning'}>{l.result}</StatusBadge>, <span title={l.detail}>{l.reason}</span>])} empty="Nothing rejected yet. Use the test tools to try it." step={15} />
        </div>
        <div className="grid gap-3.5">
          <div className={CARD}>
            <h2 className={CARD_H2}>Validation rules</h2>
            <ul className="mt-0 mb-3 pl-5 list-disc text-mut text-[14px]">
              <li>Only devices with a valid key are accepted.</li><li>The same reading is never stored twice.</li><li>Values must be numbers within the possible range, with a sensible timestamp.</li>
              <li>A jump larger than the limit is stored but flagged.</li><li>An online device whose sensor is silent for {STALE_MS / 1000} s raises a missing-data alert.</li>
              <li>Offline devices keep trying to reconnect. Firmware 1.2.0+ stores readings and sends them when back online.</li>
            </ul>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr>
                    {['Sensor', 'Possible range', 'Largest jump'].map((h) => (
                      <th key={h} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(M).map((m) => (
                    <tr key={m}>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{M[m].n}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{VALID[m][0]} to {VALID[m][1]}{M[m].u}</td>
                      <td className="py-[9px] px-2 border-b border-line align-middle">{SPIKE[m]}{M[m].u}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {canDev && (
            <div className={CARD}>
              <h2 className={CARD_H2}>Test tools</h2>
              <p className="text-mut mt-0 mb-2 text-[13px]">Pretend to be an ESP32 and watch how the system reacts.</p>
              <Field label="Sensor">
                <select value={sensor?.id || ''} onChange={(e) => setSid(e.target.value)}>
                  {d.sensors.filter((s) => s.area).map((s) => <option key={s.id} value={s.id}>{s.id} · {M[s.type].n} · {d.areas.find((a) => a.id === s.area)?.name}</option>)}
                </select>
              </Field>
              <div className={`${ACTS} mb-3`}>
                {[['invalid', 'Invalid value'], ['duplicate', 'Duplicate'], ['spike', 'Sudden jump'], ['badkey', 'Wrong device key']].map(([k, l]) => (
                  <button key={k} className={BTN_SM} disabled={!sensor} onClick={() => send(k)}>{l}</button>
                ))}
              </div>
              <Field label="Device">
                <select value={dev?.id || ''} onChange={(e) => setDid(e.target.value)}>
                  {d.devices.filter((v) => v.status === 'online').map((v) => <option key={v.id} value={v.id}>{v.code} · {canBuffer(v) ? 'stores data offline' : 'no offline storage'}</option>)}
                </select>
              </Field>
              <button className={BTN_SM} disabled={!dev} onClick={drop}>Drop Wi-Fi</button>
            </div>
          )}
        </div>
      </div>
      {cf && <Confirm title="Rotate device key?" ok="Rotate key" danger onOk={rotate} onClose={() => setCf(null)}>A new key is created for <b>{cf.code}</b>. The device keeps using its old key, so its data is rejected until you provision the new key.</Confirm>}
      {toast}
    </div>
  );
}

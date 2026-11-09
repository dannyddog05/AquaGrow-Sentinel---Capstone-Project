import { useState } from 'react';
import Chart from './Chart';
import { StatusDot, accent } from './ui';
import { M } from '../data/constants';
import { areaStatus, devOf, level, ago, metricsOf, thOf } from '../data/db';

const Stat = ({ n, l, sub }) => (
  <div className="card stat"><div className="n">{n}</div><div className="l">{l}</div><div className="sub">{sub}</div></div>
);
const valueColor = (off, lv) => (off ? '#7b8794' : lv === 'normal' ? 'inherit' : lv === 'warning' ? '#e08a00' : '#d6336c');

export default function Dashboard({ d, user }) {
  const gardens = d.areas.filter((a) => a.kind === 'garden'), ponds = d.areas.filter((a) => a.kind === 'pond');
  const cnt = (s) => d.devices.filter((x) => x.status === s).length;
  const al = d.alertRecs.filter((x) => x.status !== 'resolved').sort((a, b) => (b.sev === 'critical') - (a.sev === 'critical') || b.t - a.t);
  const [aid, setAid] = useState(d.areas[0]?.id);
  const area = d.areas.find((a) => a.id === aid) || d.areas[0], ms = area ? metricsOf(area) : [];
  const [met, setMet] = useState('');
  const mm = ms.includes(met) ? met : ms[0];
  const healthy = Math.round((d.areas.filter((a) => areaStatus(d, a) === 'normal').length / (d.areas.length || 1)) * 100);

  return (
    <div className="pg">
      <div className="grid s5">
        <Stat n={d.farms.length} l="Registered farms" sub={`${gardens.length} gardens · ${ponds.length} ponds`} />
        <Stat n={d.areas.length} l="Monitoring areas" sub={`${gardens.length} gardens, ${ponds.length} ponds`} />
        <Stat n={cnt('online')} l="Active devices" sub={`${cnt('offline')} offline, ${cnt('disconnected')} disconnected`} />
        <Stat n={al.length} l="Active alerts" sub={`${al.filter((x) => x.sev === 'critical').length} critical, ${al.filter((x) => x.sev === 'warning').length} warning`} />
        <Stat n={`${healthy}%`} l="Areas in good health" sub="Updated just now" />
      </div>

      <div className="card hero">
        <h2>Live readings <span className="live">Simulated ESP32 feed</span></h2>
        <div className="grid cA">
          {d.areas.map((a) => {
            const st = areaStatus(d, a), dv = devOf(d, a), off = !['normal', 'warning', 'critical'].includes(st), pm = d.pumps.find((p) => p.area === a.id);
            return (
              <div className={`card ${accent(st)}`} key={a.id} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div><b className="f">{a.name}</b>
                    <div className="mut" style={{ fontSize: 12 }}>{a.kind === 'garden' ? 'Garden' : 'Pond'} · {a.crop} · {dv ? dv.code : 'No device'}</div></div>
                  <StatusDot s={st} />
                </div>
                <div className="rd">
                  {metricsOf(a).map((m) => (
                    <div key={m}><b style={{ color: valueColor(off, level(m, a.r[m], thOf(d, a))) }}>{a.r[m] ?? '—'}<small>{M[m].u}</small></b><small>{M[m].n}</small></div>
                  ))}
                </div>
                {!off && a.rt && <div className="mut" style={{ fontSize: 12 }}>Last reading {ago(a.rt)}</div>}
                {pm && <div className="mut" style={{ fontSize: 12 }}>Pump: <b>{pm.state.toUpperCase()}</b>{pm.locked ? ' · emergency stop' : ''}</div>}
                {off && <div className="mut" style={{ fontSize: 12 }}>{dv ? `Last reading ${ago(dv.seen)}` : 'No device assigned'}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid c2">
        <div className="card hero blue">
          <h2>Sensor trend
            <span className="sel">
              <select aria-label="Area" value={aid} onChange={(e) => setAid(e.target.value)}>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <select aria-label="Sensor" value={mm} onChange={(e) => setMet(e.target.value)}>{ms.map((m) => <option key={m} value={m}>{M[m].n}</option>)}</select>
            </span>
          </h2>
          <Chart pts={(area && area.h[mm]) || []} u={mm ? M[mm].u : ''} th={area && mm ? thOf(d, area)[mm] : undefined} />
        </div>
        <div className="card">
          <h2>Alerts and recommended actions <span className="pill critical">{al.length}</span></h2>
          {al.length === 0 ? <p className="mut">No active alerts. All readings are within range.</p> : al.slice(0, 5).map((x) => (
            <div key={x.id} className={`al ${x.sev}`}>
              <b className="f">{x.areaIds.map((i) => d.areas.find((a) => a.id === i)?.name).filter(Boolean).join(', ') || 'System'}</b> <span className={`pill ${x.sev}`}>{x.sev}</span>
              <p>{x.title}: <b>{x.value}</b> · Expected {x.range}</p>
              <p className="rec">{x.rec}</p>
            </div>
          ))}
          {al.length > 5 && <a href="#alerts">View all {al.length} alerts</a>}
        </div>
      </div>

      <div className="grid c2">
        <div className="card">
          <h2>Farm health overview</h2>
          {d.farms.map((f) => {
            const ar = d.areas.filter((a) => a.farm === f.id), ok = ar.filter((a) => areaStatus(d, a) === 'normal').length, pc = ar.length ? (ok / ar.length) * 100 : 0;
            return (
              <div key={f.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b className="f">{f.name}</b><span className="mut">{ok}/{ar.length} areas healthy</span></div>
                <div className="bar" style={{ margin: '6px 0 8px' }}><i style={{ width: `${pc}%`, background: pc > 66 ? '#2f9e44' : pc > 33 ? '#e08a00' : '#d6336c' }} /></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ar.map((a) => <span key={a.id} className={`pill ${areaStatus(d, a)}`}>{a.name}</span>)}</div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2>Recent notifications</h2>
          {d.notifs.filter((n) => n.to?.includes(user.id)).slice(0, 6).map((n) => (
            <div className="nt" key={n.id}><span className={`dot ${n.sev}`} /><div><b>{n.title}</b><div className="mut">{n.msg}</div><small className="mut">{ago(n.t)}</small></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

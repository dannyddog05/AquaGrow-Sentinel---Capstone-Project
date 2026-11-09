import { useState } from 'react';
import { STYPES, RESERVED } from '../data/constants';
import { boardOf } from '../data/db';

export default function PinMap({ d }) {
  const [id, setId] = useState(d.devices[0]?.id);
  const dv = d.devices.find((x) => x.id === id) || d.devices[0];
  if (!dv) return <div className="card"><p className="mut">No devices registered.</p></div>;
  const board = boardOf(dv), ss = d.sensors.filter((s) => s.dev === dv.id);
  const total = board.analog.length + board.digital.length, used = ss.length;
  const Chips = ({ pins, kind }) => (
    <div className="pins">
      {pins.map((p) => {
        const s = ss.find((x) => x.pin === p);
        return (
          <div key={p} className={`pin ${s ? 'used' : 'free'}`} title={s ? `${s.id} · ${STYPES[s.type].name}` : `GPIO${p} available for ${kind} sensors`}>
            <b>{p}</b>{s ? s.id : 'free'}
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="card">
      <h2>GPIO pin map
        <select className="inp" aria-label="Device" value={dv.id} onChange={(e) => setId(e.target.value)}>
          {d.devices.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
        </select>
      </h2>
      <p className="mut" style={{ marginTop: 0 }}>{dv.board} · <b>{used}</b> of {total} usable pins occupied · {total - used} available</p>
      <b className="f">Analog inputs (ADC1)</b><Chips pins={board.analog} kind="analog" />
      <b className="f">Digital GPIO</b><Chips pins={board.digital} kind="digital" />
      <b className="f">Reserved by the board</b>
      <div className="pins">{Object.entries(RESERVED).map(([p, why]) => <div key={p} className="pin res" title={why}><b>{p}</b>{why}</div>)}</div>
    </div>
  );
}

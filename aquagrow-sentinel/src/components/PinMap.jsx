import { useState } from 'react';
import { STYPES, RESERVED } from '../data/constants';
import { boardOf } from '../data/db';
import { CARD, CARD_H2, INP } from './ui';

export default function PinMap({ d }) {
  const [id, setId] = useState(d.devices[0]?.id);
  const dv = d.devices.find((x) => x.id === id) || d.devices[0];
  if (!dv) return <div className={CARD}><p className="text-mut">No devices registered.</p></div>;
  const board = boardOf(dv), ss = d.sensors.filter((s) => s.dev === dv.id);
  const total = board.analog.length + board.digital.length, used = ss.length;
  const Chips = ({ pins, kind }) => (
    <div className="flex flex-wrap gap-2 mt-2 mb-4">
      {pins.map((p) => {
        const s = ss.find((x) => x.pin === p);
        return (
          <div
            key={p}
            className={`w-[78px] border-2 rounded-[10px] py-1.5 px-1 text-center text-[12px] ${
              s ? 'border-[#9ec5f0] bg-[#e9f3fd]' : 'border-[#b7e1c1] bg-[#f0faf2]'
            }`}
            title={s ? `${s.id} · ${STYPES[s.type].name}` : `GPIO${p} available for ${kind} sensors`}
          >
            <b className="block font-display font-semibold text-[17px] leading-[1.2]">{p}</b>
            {s ? s.id : 'free'}
          </div>
        );
      })}
    </div>
  );
  return (
    <div className={CARD}>
      <h2 className={CARD_H2}>
        GPIO pin map
        <select className={INP} aria-label="Device" value={dv.id} onChange={(e) => setId(e.target.value)}>
          {d.devices.map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
        </select>
      </h2>
      <p className="text-mut mt-0 mb-3">{dv.board} · <b>{used}</b> of {total} usable pins occupied · {total - used} available</p>
      <b className="font-display">Analog inputs (ADC1)</b><Chips pins={board.analog} kind="analog" />
      <b className="font-display">Digital GPIO</b><Chips pins={board.digital} kind="digital" />
      <b className="font-display">Reserved by the board</b>
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        {Object.entries(RESERVED).map(([p, why]) => (
          <div key={p} className="w-[78px] border-2 border-[#e2e8f0] bg-[#f4f6f8] text-off rounded-[10px] py-1.5 px-1 text-center text-[12px]" title={why}>
            <b className="block font-display font-semibold text-[17px] leading-[1.2]">{p}</b>
            {why}
          </div>
        ))}
      </div>
    </div>
  );
}

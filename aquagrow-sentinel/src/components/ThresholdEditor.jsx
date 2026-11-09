import { Field } from './ui';

/** Which levels each sensor type has: c = critical, w = warning, l = low side, h = high side. */
export const SIDES = { moisture: ['cl', 'wl'], temp: ['wh', 'ch'], ph: ['cl', 'wl', 'wh', 'ch'], turb: ['wh', 'ch'] };
export const LBL = { cl: 'Critical below', wl: 'Warning below', wh: 'Warning above', ch: 'Critical above' };

export function ThresholdFields({ m, val, set }) {
  return (
    <div className="fg" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0 10px' }}>
      {SIDES[m].map((s) => <Field key={s} label={LBL[s]}><input type="number" step="any" value={val[s] ?? ''} onChange={(e) => set({ ...val, [s]: e.target.value })} /></Field>)}
    </div>
  );
}
export function parseTh(m, val) {
  const v = {}; let err = '';
  SIDES[m].forEach((s) => { const n = parseFloat(val[s]); if (isNaN(n)) err = 'Fill in every level.'; v[s] = n; });
  if (!err) {
    if (v.cl != null && v.wl != null && !(v.cl < v.wl)) err = 'Critical must be lower than warning.';
    if (v.wh != null && v.ch != null && !(v.wh < v.ch)) err = 'Warning must be lower than critical.';
    if (v.wl != null && v.wh != null && !(v.wl < v.wh)) err = 'The lower range must be below the upper range.';
  }
  return { v, err };
}

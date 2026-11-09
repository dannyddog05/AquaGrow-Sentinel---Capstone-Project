import { useEffect, useState } from 'react';

export function Modal({ title, onClose, foot, children }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="ov" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mdl" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>{children}<div className="foot">{foot}</div>
      </div>
    </div>
  );
}
export const Field = ({ label, err, cls = '', children }) => (
  <label className={`fld ${cls}${err ? ' bad' : ''}`}>{label}{children}{err && <span className="err">{err}</span>}</label>
);


const DAY = 864e5;
export const PRESETS = [['24h', 'Last 24 hours', DAY], ['7d', 'Last 7 days', 7 * DAY], ['30d', 'Last 30 days', 30 * DAY], ['90d', 'Last 90 days', 90 * DAY], ['12m', 'Last 12 months', 365 * DAY]];
export function rangeOf(v) {
  if (v.p === 'custom') { const a = new Date(v.from + 'T00:00:00').getTime(), b = new Date(v.to + 'T00:00:00').getTime() + DAY; return isNaN(a) || isNaN(b) || b <= a ? { from: 0, to: 0, error: 'Choose a valid date range (the end date cannot be before the start date).' } : { from: a, to: b }; }
  if (v.p === 'all') return { from: 0, to: Date.now() + DAY };
  return { from: Date.now() - PRESETS.find((x) => x[0] === v.p)[2], to: Date.now() + 1 };
}
export function RangeBar({ v, set, all }) {
  return (
    <div className="acts" style={{ alignItems: 'center' }}>
      <select className="inp" aria-label="Date range" value={v.p} onChange={(e) => set({ ...v, p: e.target.value })}>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}{all && <option value="all">All time</option>}<option value="custom">Custom range</option>
      </select>
      {v.p === 'custom' && <><input className="inp" type="date" aria-label="From" value={v.from} onChange={(e) => set({ ...v, from: e.target.value })} /><input className="inp" type="date" aria-label="To" value={v.to} onChange={(e) => set({ ...v, to: e.target.value })} /></>}
    </div>
  );
}
export function DataTable({ columns, rows, empty = 'No records for these filters.', step = 50 }) {
  const [n, setN] = useState(step);
  return (
    <>
      <div className="tw"><table className="tbl" style={{ minWidth: Math.max(560, columns.length * 100) }}>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="mut">{empty}</td></tr>}
          {rows.slice(0, n).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody></table></div>
      {rows.length > n && <p className="mut" style={{ fontSize: 13 }}>Showing {n} of {rows.length}. <button className="btn sm" onClick={() => setN(n + step * 2)}>Show more</button></p>}
    </>
  );
}

export function Avatar({ u, size = 36 }) {
  return <span className="avt" style={{ width: size, height: size, fontSize: size * 0.42 }}>{u.photo ? <img src={u.photo} alt="" /> : (u.name || '?')[0]}</span>;
}
export function useToast() {
  const [t, setT] = useState('');
  const say = (m) => { setT(m); setTimeout(() => setT(''), 3400); };
  return [t ? <div className="toast" role="status">{t}</div> : null, say];
}
export function Confirm({ title, children, ok = 'Confirm', danger, onOk, onClose }) {
  return <Modal title={title} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancel</button><button className={`btn ${danger ? 'crit' : 'p'}`} onClick={onOk}>{ok}</button></>}>{children}</Modal>;
}

/* Status indicator: coloured bullet + uppercase label. The bullet blinks while a device is online. */
const SD = { online: ['Online', 'ok'], normal: ['Healthy', 'ok'], warning: ['Warning', 'warn'], critical: ['Critical', 'bad'], offline: ['Offline', 'off'], disconnected: ['Disconnected', 'bad'], maintenance: ['Maintenance', 'warn'], unassigned: ['Unassigned', 'off'] };
export const accent = (s) => `acc acc-${(SD[s] || [0, 'off'])[1]}`;
export function StatusDot({ s, label }) {
  const [t, c] = SD[s] || [s, 'off'];
  return <span className={`sd ${c}`}><i className={s === 'online' ? 'blink' : ''} />{label || t}</span>;
}

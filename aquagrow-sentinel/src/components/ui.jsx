import { useEffect, useState } from 'react';

/* Reusable Tailwind class presets matching AquaGrow Sentinel's design system */
export const BTN = 'inline-flex items-center justify-center gap-1.5 border border-line bg-white px-3 py-[7px] rounded-[9px] font-semibold text-ink hover:bg-brand-soft disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0 transition-colors';
export const BTN_P = 'inline-flex items-center justify-center gap-1.5 border border-brand bg-brand text-white px-3 py-[7px] rounded-[9px] font-semibold hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0 transition-colors';
export const BTN_CRIT = 'inline-flex items-center justify-center gap-1.5 border border-crit bg-crit text-white px-3 py-[7px] rounded-[9px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0 transition-colors';
export const BTN_SM = 'inline-flex items-center justify-center gap-1 border border-line bg-white px-2.5 py-1 rounded-[9px] text-[13px] font-semibold text-ink hover:bg-brand-soft disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const BTN_SM_P = 'inline-flex items-center justify-center gap-1 border border-brand bg-brand text-white px-2.5 py-1 rounded-[9px] text-[13px] font-semibold hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const BTN_SM_D = 'inline-flex items-center justify-center gap-1 border border-[#f3c3d3] bg-white px-2.5 py-1 rounded-[9px] text-[13px] font-semibold text-crit hover:bg-[#fff2f6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const BTN_GHOST = 'inline-flex items-center justify-center gap-1 border border-transparent bg-transparent px-2.5 py-1 rounded-[9px] text-[13px] font-semibold text-mut hover:bg-brand-soft transition-colors';
export const INP = 'px-3 py-[9px] border border-line rounded-[9px] bg-white min-w-0 text-[16px] sm:text-[15px]';
export const CARD = 'bg-card/92 backdrop-blur-sm border border-line rounded-[14px] p-4 min-w-0';
export const CARD_H2 = 'text-[16px] font-bold font-display mb-3 flex justify-between items-center gap-2';
export const PG = 'p-3 sm:p-4 lg:py-5 lg:px-6 grid gap-3 sm:gap-[18px] max-w-[1500px] 3xl:max-w-[1700px]';
export const BAR2 = 'flex gap-2.5 flex-wrap items-center justify-between';
export const ACTS = 'flex gap-1.5 flex-wrap items-center';
export const STAT_STRIP = 'grid grid-cols-2 sm:flex sm:flex-wrap gap-0 bg-white/92 backdrop-blur-sm border border-line rounded-[12px] sm:px-1 sm:py-0.5';
export const STAT_CELL = 'min-w-0 sm:flex-1 sm:basis-[150px] sm:min-w-[140px] px-3 py-2 sm:px-4 sm:py-[9px] border-r border-b sm:border-b-0 border-line even:border-r-0 sm:even:border-r last:border-r-0 last:border-b-0';
export const ROLE_CHIP = 'text-[12px] bg-accent-soft text-accent-dark px-2 py-0.5 rounded-full font-bold inline-block';
export const INNER_TABS = 'flex gap-1.5 overflow-x-auto flex-nowrap no-scrollbar';
export const innerTab = (on) =>
  on
    ? 'border border-brand bg-brand text-white px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors'
    : 'border border-line bg-white text-mut px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap hover:bg-brand-soft transition-colors';
export const SPIN = 'w-4 h-4 border-[3px] border-white/30 border-t-white rounded-full inline-block animate-spin align-[-3px] mr-1.5';
export const KEY_CODE = 'font-mono bg-[#f1f5f3] px-2 py-0.5 rounded-[6px] break-all';
export const TG_ROW = 'flex justify-between items-center gap-2.5 py-2 border-b border-line';
export const CHK_LBL = 'inline-flex gap-2 items-center font-semibold mr-3.5';
export const KV_DL = 'grid grid-cols-[100px_1fr] sm:grid-cols-[130px_1fr] gap-x-2.5 gap-y-1.5 text-[14px] m-0 mb-3';
export const BANNER = 'bg-[#fff2f6] border border-[#f3c3d3] text-[#8a1c44] rounded-[10px] px-3 py-2.5 text-[14px]';
export const ERR_TXT = 'text-crit text-[13px] font-semibold';

export const STATUS_BG = {
  normal: 'bg-ok',
  online: 'bg-ok',
  warning: 'bg-warn',
  critical: 'bg-crit',
  offline: 'bg-off',
  disconnected: 'bg-disc',
  unassigned: 'bg-unassigned',
};
export const pill = (s) => `inline-block px-2.5 py-0.5 rounded-full text-[12px] font-bold text-white ${STATUS_BG[s] || 'bg-off'}`;

export function Card({ children, className = '', hero = false, heroColor = 'brand', status }) {
  const heroCls = hero
    ? heroColor === 'blue'
      ? 'border-t-[3px] border-t-accent shadow-[0_8px_24px_rgba(28,126,214,0.09)]'
      : 'border-t-[3px] border-t-brand shadow-[0_8px_24px_rgba(31,111,58,0.09)]'
    : '';
  const statusCls = status ? accent(status) : '';
  return <div className={`${CARD} ${heroCls} ${statusCls} ${className}`}>{children}</div>;
}

export function StatStrip({ children, className = '' }) {
  return <div className={`${STAT_STRIP} ${className}`}>{children}</div>;
}

export function StatCard({ value, label, sub, valueClassName = '' }) {
  return (
    <div className={STAT_CELL}>
      <div className={`font-display font-bold text-[20px] leading-[1.15] tracking-[-0.01em] ${valueClassName}`}>{value}</div>
      <div className="text-mut text-[12px] mt-[3px]">{label}</div>
      {sub && <div className="text-mut text-[11px] mt-[2px]">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status, children, className = '', title }) {
  return (
    <span className={`${pill(status)} ${className}`} title={title}>
      {children ?? status}
    </span>
  );
}

export function Modal({ title, onClose, foot, children }) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-ink/45 grid place-items-end sm:place-items-center p-0 sm:p-4 z-30 overflow-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-[16px] sm:rounded-[16px] p-4 sm:p-5 w-full max-w-[640px] max-h-[94vh] sm:max-h-[92vh] overflow-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-[20px] font-bold font-display mb-3.5">{title}</h2>
        {children}
        <div className="flex gap-2 justify-end mt-4 flex-wrap">{foot}</div>
      </div>
    </div>
  );
}

export const Field = ({ label, err, cls = '', children }) => (
  <label
    className={`grid gap-1 ${cls.includes('mb-') ? '' : 'mb-3'} font-semibold text-[13px] ${cls === 'full' ? 'col-span-full' : cls} [&_input]:px-3 [&_input]:py-2.5 [&_input]:border [&_input]:rounded-[9px] [&_input]:bg-white [&_input]:font-normal [&_input]:text-[16px] sm:[&_input]:text-[15px] [&_select]:px-3 [&_select]:py-2.5 [&_select]:border [&_select]:rounded-[9px] [&_select]:bg-white [&_select]:font-normal [&_select]:text-[16px] sm:[&_select]:text-[15px] [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:border [&_textarea]:rounded-[9px] [&_textarea]:bg-white [&_textarea]:font-normal [&_textarea]:text-[16px] sm:[&_textarea]:text-[15px] ${err
        ? '[&_input]:border-crit [&_select]:border-crit [&_textarea]:border-crit'
        : '[&_input]:border-line [&_select]:border-line [&_textarea]:border-line'
      }`}
  >
    {label}
    {children}
    {err && <span className={ERR_TXT}>{err}</span>}
  </label>
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
    <div className={ACTS}>
      <select className={INP} aria-label="Date range" value={v.p} onChange={(e) => set({ ...v, p: e.target.value })}>
        {PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}{all && <option value="all">All time</option>}<option value="custom">Custom range</option>
      </select>
      {v.p === 'custom' && (
        <>
          <input className={INP} type="date" aria-label="From" value={v.from} onChange={(e) => set({ ...v, from: e.target.value })} />
          <input className={INP} type="date" aria-label="To" value={v.to} onChange={(e) => set({ ...v, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

export function DataTable({ columns, rows, empty = 'No records for these filters.', step = 50 }) {
  const [n, setN] = useState(step);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]" style={{ minWidth: Math.max(560, columns.length * 100) }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left text-mut font-semibold p-2 border-b-2 border-line whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="text-mut py-2.5 px-2 border-b border-line">{empty}</td></tr>
            )}
            {rows.slice(0, n).map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="py-[9px] px-2 border-b border-line align-middle">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > n && (
        <p className="text-mut text-[13px] mt-2">
          Showing {n} of {rows.length}. <button className={BTN_SM} onClick={() => setN(n + step * 2)}>Show more</button>
        </p>
      )}
    </>
  );
}

export function Avatar({ u, size = 36 }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full bg-brand text-white font-bold overflow-hidden flex-none font-display"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {u.photo ? <img src={u.photo} alt="" className="w-full h-full object-cover block" /> : (u.name || '?')[0]}
    </span>
  );
}

export function useToast() {
  const [t, setT] = useState('');
  const say = (m) => { setT(m); setTimeout(() => setT(''), 3400); };
  return [
    t ? (
      <div
        className="fixed left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2.5 rounded-[10px] z-20 text-[14px] shadow-lg"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        role="status"
      >
        {t}
      </div>
    ) : null,
    say,
  ];
}

export function Confirm({ title, children, ok = 'Confirm', danger, onOk, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      foot={
        <>
          <button className={BTN} onClick={onClose}>Cancel</button>
          <button className={danger ? BTN_CRIT : BTN_P} onClick={onOk}>{ok}</button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* Status indicator: coloured bullet + uppercase label. The bullet blinks while a device is online. */
const SD = {
  online: ['Online', 'ok'],
  normal: ['Healthy', 'ok'],
  warning: ['Warning', 'warn'],
  critical: ['Critical', 'bad'],
  offline: ['Offline', 'off'],
  disconnected: ['Disconnected', 'bad'],
  maintenance: ['Maintenance', 'warn'],
  unassigned: ['Unassigned', 'off'],
};

const ACCENT_BORDER = {
  ok: 'border-l-4 border-l-ok',
  warn: 'border-l-4 border-l-warn',
  bad: 'border-l-4 border-l-crit',
  off: 'border-l-4 border-l-[#b8c2cc]',
};

const SD_TEXT = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-crit',
  off: 'text-off',
};

export const accent = (s) => `transition-[box-shadow,transform] duration-200 hover:shadow-[0_6px_18px_rgba(18,48,42,0.08)] ${ACCENT_BORDER[(SD[s] || [0, 'off'])[1]]}`;

export function StatusDot({ s, label, className = '' }) {
  const [t, c] = SD[s] || [s, 'off'];
  return (
    <span className={`inline-flex items-center gap-[7px] font-extrabold text-[12px] tracking-[0.06em] uppercase whitespace-nowrap leading-none self-start mt-[3px] ${SD_TEXT[c] || 'text-off'} ${className}`}>
      <i className={`w-[9px] h-[9px] rounded-full bg-current flex-none ${s === 'online' ? 'animate-status-blink' : ''}`} />
      {label || t}
    </span>
  );
}

import { KIND, DEFV } from './constants';

const H = 3600e3, D = 864e5;
export const dayStart = (t) => { const x = new Date(t); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
export const hourStart = (t) => Math.floor(t / H) * H;
const mets = (a) => (a.metrics && a.metrics.length ? a.metrics : KIND[a.kind]);
export const hkey = (areaId, m) => areaId + ':' + m;
const R = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Readings are stored as aggregated buckets [time, sum, min, max, count]: hourly (31 days) and daily (400 days),
   so the browser storage stays small. A real backend would keep every raw reading. */
function put(arr, t, v, cap) {
  let i = arr.length - 1;
  while (i >= 0 && arr[i][0] > t) i--;            // back-filled readings go into their original time slot
  const L = arr[i];
  if (L && L[0] === t) { L[1] += v; L[2] = Math.min(L[2], v); L[3] = Math.max(L[3], v); L[4] += 1; }
  else { arr.splice(i + 1, 0, [t, v, v, v, 1]); if (arr.length > cap) arr.splice(0, arr.length - cap); }
}
export function record(n, areaId, m, v, ts = Date.now()) {
  n.hist = n.hist || {};
  const h = n.hist[hkey(areaId, m)] || (n.hist[hkey(areaId, m)] = { h: [], d: [] });
  put(h.h, hourStart(ts), v, 744); put(h.d, dayStart(ts), v, 400);
}

export const logCat = (m) =>
  /pump|irrigation|emergency/i.test(m) ? 'Irrigation'
  : /calibrat|maintenance|battery|repair|cleaning/i.test(m) ? 'Maintenance'
  : /alert/i.test(m) ? 'Alerts'
  : /threshold|notification|preference|setting|backup|sync/i.test(m) ? 'Settings'
  : /device|sensor|ESP32|pin/i.test(m) ? 'Devices & sensors'
  : /farm|garden|pond|area/i.test(m) ? 'Farms' : 'System';

/** Synthetic past data so history and reports have something to show. Everything before "now" is sample data. */
export function genHist(d) {
  const T = Date.now(), hist = {};
  const val = (m, base, hAgo) => {
    const dh = new Date(T - hAgo * H).getHours(), x = (T - hAgo * H) / H;
    if (m === 'moisture') return clamp(74 - ((Math.floor(x / 6) % 12) / 12) * 42 + R(-3, 3), 12, 92);
    if (m === 'temp') return base - 2 + 2.2 * Math.sin(((dh - 9) / 24) * 2 * Math.PI) + R(-0.4, 0.4);
    if (m === 'ph') return clamp(7.2 + Math.sin(x / 60) * 0.35 + R(-0.1, 0.1), 5.8, 9);
    return Math.max(3, base * 0.5 + 8 * Math.sin(x / 30) + (Math.random() < 0.02 ? R(40, 90) : 0) + R(-3, 3));
  };
  const spread = { moisture: 3, temp: 0.6, ph: 0.15, turb: 6 };
  d.areas.forEach((a) => {
    const dv = d.devices.find((v) => v.id === a.dev);
    const gapH = dv && dv.status !== 'online' ? Math.ceil((T - (dv.seen || T)) / H) : 0;
    mets(a).forEach((m) => {
      const base = a.r[m] ?? DEFV[m], hr = [], dy = [], byDay = {};
      for (let i = 31 * 24; i >= 1; i--) {
        if (i <= gapH || Math.random() < 0.01) continue;
        const v = val(m, base, i), n = Math.round(900 * R(0.93, 1)), t = hourStart(T - i * H);
        hr.push([t, v * n, v - R(0, spread[m]), v + R(0, spread[m]), n]);
        const k = dayStart(t), b = byDay[k] || (byDay[k] = [k, 0, Infinity, -Infinity, 0]);
        b[1] += v * n; b[2] = Math.min(b[2], hr[hr.length - 1][2]); b[3] = Math.max(b[3], hr[hr.length - 1][3]); b[4] += n;
      }
      for (let i = 400; i > 31; i--) {
        const t = dayStart(T - i * D), v = val(m, base, i * 24 + 12), n = Math.round(21600 * R(0.9, 1));
        dy.push([t, v * n, v - spread[m] * 1.6, v + spread[m] * 1.6, n]);
      }
      Object.values(byDay).sort((x, y) => x[0] - y[0]).forEach((b) => dy.push(b));
      hist[hkey(a.id, m)] = { h: hr, d: dy };
    });
  });
  return hist;
}

/** Sample alert history, activity log entries and irrigation sessions for the past weeks. */
export function seedHistory(d) {
  const T = Date.now(), pick = (a) => a[Math.floor(Math.random() * a.length)], staff = ['Juan Dela Cruz', 'Pedro Lim'];
  const gardenAl = { title: 'Soil moisture low', val: () => `${Math.round(R(22, 38))}%`, range: '≥ 40%', rec: 'Start irrigation or check the water supply.', acts: ['Ran the pump for 10 minutes and checked the drip lines', 'Watered the bed by hand and cleared a blocked emitter'] };
  const pondAl = [
    { title: 'Water temp high', val: () => `${R(32.4, 35.8).toFixed(1)}°C`, range: '≤ 32°C', rec: 'Add shade or fresh water and reduce feeding.', acts: ['Added a shade net and topped up with fresh water', 'Reduced feeding for the day'] },
    { title: 'Turbidity high', val: () => `${Math.round(R(55, 130))} NTU`, range: '≤ 50 NTU', rec: 'Check filtration, reduce feeding and remove debris.', acts: ['Cleaned the filter and removed debris', 'Skipped one feeding and checked the aerator'] },
    { title: 'pH low', val: () => R(5.8, 6.4).toFixed(1), range: '6.5–8.5', rec: 'Test the water and add buffer such as agricultural lime.', acts: ['Added agricultural lime and retested after two hours'] }];
  const alerts = [2, 3, 5, 8, 11, 15, 21, 29, 40, 52].map((dd, i) => {
    const a = d.areas[i % Math.max(1, d.areas.length)]; if (!a) return null;
    const c = a.kind === 'garden' ? gardenAl : pick(pondAl), v = c.val(), t = T - dd * D - R(0, 8) * H, auto = i % 4 === 3, by = pick(staff);
    const ack = auto ? null : t + R(3, 40) * 60000, res = (ack || t) + R(20, 240) * 60000, act = pick(c.acts);
    const sev = parseFloat(v) < 25 || parseFloat(v) > 100 || i % 5 === 0 ? 'critical' : 'warning';
    return { id: 'alh' + i, key: 'h:' + i, kind: 'reading', sev, areaIds: [a.id], title: c.title, value0: v, value: v, range: c.range, rec: c.rec, t, status: 'resolved',
      ackAt: ack, ackBy: auto ? null : by, resolvedAt: res, resolvedBy: auto ? 'System' : by, auto, assignee: null, escalated: false, hold: false,
      tl: [{ t, by: 'System', type: 'sys', text: `Detected: ${v} (expected ${c.range})` }, ...(auto ? [{ t: res, by: 'System', type: 'sys', text: 'Back to normal. Resolved automatically.' }] : [{ t: ack, by, type: 'sys', text: 'Acknowledged' }, { t: ack + 60000, by, type: 'action', text: act }, { t: res, by, type: 'sys', text: 'Resolved' }])] };
  }).filter(Boolean);
  const off = d.devices.find((v) => v.status !== 'online' && d.areas.some((a) => a.dev === v.id));
  if (off) { const t = T - 9 * D; alerts.push({ id: 'alh-off', key: 'h:off', kind: 'device', sev: 'offline', areaIds: d.areas.filter((a) => a.dev === off.id).map((a) => a.id), title: off.code + ' offline', value0: 'No data', value: 'No data', range: 'Device online', rec: 'Check power, Wi-Fi and the antenna.', t, status: 'resolved', ackAt: t + 600000, ackBy: 'Pedro Lim', resolvedAt: t + 5400000, resolvedBy: 'Pedro Lim', auto: false, assignee: null, escalated: false, hold: false, tl: [{ t, by: 'System', type: 'sys', text: 'Detected: No data (expected Device online)' }, { t: t + 4000000, by: 'Pedro Lim', type: 'action', text: 'Replaced the battery and checked Wi-Fi' }, { t: t + 5400000, by: 'Pedro Lim', type: 'sys', text: 'Resolved' }] }); }
  d.alertRecs = [...d.alertRecs, ...alerts].sort((a, b) => b.t - a.t);

  const L = [], add = (dd, by, msg) => L.push({ id: 'lh' + L.length, t: T - dd * D - R(0, 6) * H, by, msg });
  const O = 'Maria Santos', J = 'Juan Dela Cruz', P = 'Pedro Lim';
  d.farms.forEach((f, i) => add(60 - i, O, `Added farm "${f.name}"`));
  d.areas.forEach((a, i) => add(58 - i, O, `Added ${a.kind} "${a.name}"`));
  d.devices.forEach((v, i) => add(56 - i, O, `Registered device ${v.code}`));
  d.sensors.slice(0, 6).forEach((s, i) => add(54 - i, J, `Registered sensor ${s.id}`));
  d.sensors.filter((s) => s.calib).slice(0, 4).forEach((s, i) => add(40 - i * 6, J, `Recorded calibration (${s.calib.result}) for ${s.id}`));
  if (d.areas[2]) add(12, O, `Changed threshold for "${d.areas[2].name}": Water temp warning above 31 → 32`);
  if (d.devices[1]) add(6, P, `Set ${d.devices[1].code} maintenance status to Service due`);
  if (d.areas[0]) add(4, J, `Sent pump ON command for ${d.areas[0].name}`);
  add(3, O, 'Updated notification preferences');
  d.logs = [...(d.logs || []), ...L].sort((a, b) => b.t - a.t).slice(0, 500);

  (d.pumps || []).forEach((p) => {
    if (p.sessions.length >= 5) return;
    for (let i = 0; i < 18; i++) {
      const dd = 1 + Math.floor(R(0, 30)), start = dayStart(T - dd * D) + (Math.random() < 0.5 ? 6 : 18) * H + R(0, 20) * 60000, sec = Math.round(R(240, 720)), tr = pick(['manual', 'schedule', 'schedule', 'auto']);
      p.sessions.push({ id: 'sh' + p.id + i, start, end: start + sec * 1000, sec, trigger: tr, stoppedBy: tr === 'manual' ? 'Manual · ' + pick(staff) : tr === 'auto' ? 'Automatic (target reached)' : 'Timer' });
    }
    p.sessions.sort((a, b) => b.start - a.start);
  });
}

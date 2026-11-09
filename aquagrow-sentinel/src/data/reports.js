import { M } from './constants';
import { metricsOf, thOf, areaStatus, sensorConn, calibState } from './db';
import { hkey, logCat } from './history';

const H = 3600e3, D = 864e5, EXPECTED = 900; // nominal readings per hour (one every 4 s)
export const fmtDT = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtD = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
export const ymd = (off = 0) => { const x = new Date(Date.now() + off * D); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const pd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const f1 = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
const mins = (sec) => `${Math.round(sec / 60)} min`;

export const REPORTS = [['soil', 'Soil moisture report'], ['water', 'Water quality report'], ['alerts', 'Alert report'], ['devices', 'Device performance report'], ['maint', 'Maintenance report'], ['farm', 'Farm summary report']];
export const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly'], ['custom', 'Custom range']];

export function periodRange(kind, v) {
  try {
    if (kind === 'daily') { const s = pd(v.date); return { from: s.getTime(), to: addD(s, 1).getTime(), label: fmtD(s) }; }
    if (kind === 'weekly') { const s = pd(v.date), st = addD(s, -((s.getDay() + 6) % 7)); return { from: st.getTime(), to: addD(st, 7).getTime(), label: `${fmtD(st)} – ${fmtD(addD(st, 6))}` }; }
    if (kind === 'monthly') { const [y, m] = v.month.split('-').map(Number), s = new Date(y, m - 1, 1); return { from: s.getTime(), to: new Date(y, m, 1).getTime(), label: s.toLocaleDateString([], { month: 'long', year: 'numeric' }) }; }
    if (kind === 'yearly') { const y = parseInt(v.year); if (!(y > 1999 && y < 2100)) return { error: 'Enter a valid year.' }; return { from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), label: String(y) }; }
    if (!v.from || !v.to) return { error: 'Choose both dates.' };
    const a = pd(v.from), b = addD(pd(v.to), 1);
    if (b <= a) return { error: 'The end date must not be before the start date.' };
    if (b - a > 400 * D) return { error: 'Choose a range of at most 400 days.' };
    return { from: a.getTime(), to: b.getTime(), label: `${fmtD(a)} – ${fmtD(addD(b, -1))}` };
  } catch (e) { return { error: 'Choose a valid date.' }; }
}

export function buckets(d, areaId, m, from, to) {
  const h = d.hist && d.hist[hkey(areaId, m)];
  if (!h) return [];
  return (to - from <= 3 * D ? h.h : h.d).filter((b) => b[0] >= from && b[0] < to);
}
export function stat(bs) {
  let s = 0, n = 0, mn = Infinity, mx = -Infinity;
  bs.forEach((b) => { s += b[1]; n += b[4]; mn = Math.min(mn, b[2]); mx = Math.max(mx, b[3]); });
  return n ? { avg: s / n, min: mn, max: mx, n } : null;
}
const sensorOf = (d, a, m) => d.sensors.find((s) => s.area === a.id && s.type === m);
/** Table rows (one per time bucket) for an area and sensor type. */
export function readingRows(d, a, m, from, to) {
  const fm = to - from <= 3 * D ? fmtDT : fmtD, sn = sensorOf(d, a, m), dv = d.devices.find((v) => v.id === a.dev);
  return buckets(d, a.id, m, from, to).map((b) => [b[0], fm(b[0]), a.name, sn ? sn.id : '—', dv ? dv.code : '—', f1(b[1] / b[4]) + M[m].u, f1(b[2]) + M[m].u, f1(b[3]) + M[m].u, b[4]]);
}
const pick = (d, f) => (f === 'all' ? d.areas : f.startsWith('farm:') ? d.areas.filter((a) => a.farm === f.slice(5)) : d.areas.filter((a) => a.id === f));
const farmOf = (d, a) => d.farms.find((x) => x.id === a.farm)?.name || '—';
const inR = (t, r) => t >= r.from && t < r.to;
const series = (d, areas, m, r) => areas.map((a) => ({ name: a.name, pts: buckets(d, a.id, m, r.from, r.to).map((b) => [b[0], b[1] / b[4]]) })).filter((s) => s.pts.length);
const detail = (d, areas, m, r) => ({ title: `${M[m].n} readings`, columns: ['Time', 'Area', 'Sensor', 'ESP32', 'Average', 'Min', 'Max', 'Samples'], rows: areas.flatMap((a) => readingRows(d, a, m, r.from, r.to)).sort((x, y) => y[0] - x[0]).map((x) => x.slice(1)), note: (r.to - r.from <= 3 * D ? 'Hourly' : 'Daily') + ' values.' });
const areaAlerts = (d, areas, r) => { const ids = new Set(areas.map((a) => a.id)); return d.alertRecs.filter((x) => inR(x.t, r) && (!x.areaIds.length || x.areaIds.some((i) => ids.has(i)))); };

function soil(d, areas, r) {
  const gs = areas.filter((a) => a.kind === 'garden');
  const all = gs.flatMap((a) => buckets(d, a.id, 'moisture', r.from, r.to)), S = stat(all);
  let runs = 0, sec = 0;
  const rows = gs.map((a) => {
    const bs = buckets(d, a.id, 'moisture', r.from, r.to), s = stat(bs), t = thOf(d, a).moisture || {}, pm = d.pumps.find((p) => p.area === a.id);
    const ss = (pm ? pm.sessions : []).filter((x) => inR(x.start, r)), tot = ss.reduce((q, x) => q + x.sec, 0); runs += ss.length; sec += tot;
    const below = t.wl != null && bs.length ? Math.round((bs.filter((b) => b[1] / b[4] < t.wl).length / bs.length) * 100) + '%' : '—';
    return [a.name, farmOf(d, a), s ? f1(s.avg) + '%' : '—', s ? f1(s.min) + '%' : '—', s ? f1(s.max) + '%' : '—', below, ss.length, mins(tot)];
  });
  const one = gs.length === 1 ? thOf(d, gs[0]).moisture || {} : {};
  return { summary: [['Gardens', gs.length], ['Average soil moisture', S ? f1(S.avg) + '%' : '—'], ['Lowest reading', S ? f1(S.min) + '%' : '—'], ['Highest reading', S ? f1(S.max) + '%' : '—'], ['Irrigation runs', runs], ['Irrigation time', mins(sec)]],
    sections: [{ title: 'Soil moisture summary', columns: ['Garden', 'Farm', 'Average', 'Min', 'Max', 'Periods below warning level', 'Irrigation runs', 'Irrigation time'], rows, chart: { type: 'line', unit: '%', series: series(d, gs, 'moisture', r), bands: [{ y: one.wl, color: '#e08a00' }, { y: one.cl, color: '#d6336c' }].filter((b) => b.y != null) } }, detail(d, gs, 'moisture', r)] };
}
function water(d, areas, r) {
  const ps = areas.filter((a) => a.kind === 'pond'), ms = ['temp', 'ph', 'turb'], rows = [];
  ps.forEach((a) => ms.filter((m) => metricsOf(a).includes(m)).forEach((m) => {
    const bs = buckets(d, a.id, m, r.from, r.to), s = stat(bs), t = thOf(d, a)[m] || {};
    const out = bs.length ? Math.round((bs.filter((b) => { const v = b[1] / b[4]; return (t.wl != null && v < t.wl) || (t.wh != null && v > t.wh); }).length / bs.length) * 100) + '%' : '—';
    rows.push([a.name, M[m].n, s ? f1(s.avg) + M[m].u : '—', s ? f1(s.min) + M[m].u : '—', s ? f1(s.max) + M[m].u : '—', out]);
  }));
  const avg = (m) => { const s = stat(ps.flatMap((a) => buckets(d, a.id, m, r.from, r.to))); return s ? f1(s.avg) + M[m].u : '—'; };
  return { summary: [['Ponds', ps.length], ['Average water temp', avg('temp')], ['Average pH', avg('ph')], ['Average turbidity', avg('turb')]],
    sections: [{ title: 'Water quality summary', columns: ['Pond', 'Sensor', 'Average', 'Min', 'Max', 'Periods outside acceptable range'], rows },
      ...ms.map((m) => ({ title: `${M[m].n} trend`, chart: { type: 'line', unit: M[m].u, series: series(d, ps, m, r), bands: ps.length === 1 ? [{ y: (thOf(d, ps[0])[m] || {}).wh, color: '#e08a00' }, { y: (thOf(d, ps[0])[m] || {}).wl, color: '#e08a00' }].filter((b) => b.y != null) : [] } })),
      ...ms.map((m) => detail(d, ps.filter((a) => metricsOf(a).includes(m)), m, r))] };
}
function alerts(d, areas, r) {
  const L = areaAlerts(d, areas, r).sort((a, b) => b.t - a.t), c = (s) => L.filter((x) => x.sev === s).length, avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length / 60000) + ' min' : '—');
  const nm = (x) => x.areaIds.map((i) => d.areas.find((a) => a.id === i)?.name).filter(Boolean).join(', ') || 'System';
  const byArea = areas.map((a) => { const q = L.filter((x) => x.areaIds.includes(a.id)); return [a.name, q.length, q.filter((x) => x.sev === 'critical').length, q.filter((x) => x.sev === 'warning').length, q.filter((x) => x.sev === 'offline').length]; });
  const month = r.to - r.from > 62 * D, g = {};
  L.forEach((x) => { const k = month ? new Date(new Date(x.t).getFullYear(), new Date(x.t).getMonth(), 1).getTime() : new Date(new Date(x.t).getFullYear(), new Date(x.t).getMonth(), new Date(x.t).getDate()).getTime(); g[k] = (g[k] || 0) + 1; });
  const pts = Object.entries(g).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]);
  return { summary: [['Total alerts', L.length], ['Critical', c('critical')], ['Warning', c('warning')], ['Offline', c('offline')], ['Avg. time to acknowledge', avg(L.filter((x) => x.ackAt).map((x) => x.ackAt - x.t))], ['Avg. time to resolve', avg(L.filter((x) => x.resolvedAt).map((x) => x.resolvedAt - x.t))]],
    sections: [{ title: `Alerts per ${month ? 'month' : 'day'}`, chart: { type: 'bar', unit: 'alerts', series: [{ name: 'Alerts', pts }] } },
      { title: 'Alerts by area', columns: ['Area', 'Total', 'Critical', 'Warning', 'Offline'], rows: byArea },
      { title: 'Alert log', columns: ['Detected', 'Area', 'Alert', 'Severity', 'Detected reading', 'Expected', 'Acknowledged', 'Resolved', 'Assigned / handled by', 'Actions taken'],
        rows: L.map((x) => [fmtDT(x.t), nm(x), x.title, x.sev, x.value0, x.range, x.ackAt ? `${fmtDT(x.ackAt)} (${x.ackBy})` : 'No', x.resolvedAt ? `${fmtDT(x.resolvedAt)} (${x.resolvedBy})` : 'Open', x.assignee || x.ackBy || x.resolvedBy || '—', x.tl.filter((e) => e.type === 'action').map((e) => e.text).join('; ') || '—']) }] };
}
function devices(d, areas, r) {
  const ids = new Set(areas.map((a) => a.dev)), devs = d.devices.filter((v) => ids.has(v.id)), T = Date.now();
  const hours = Math.max(0, (Math.min(r.to, T) - r.from) / H);
  const rows = devs.map((v) => {
    const keys = d.areas.filter((a) => a.dev === v.id).flatMap((a) => metricsOf(a).map((m) => [a.id, m])), n = keys.reduce((s, [id, m]) => s + (stat(buckets(d, id, m, r.from, r.to))?.n || 0), 0), exp = EXPECTED * hours * keys.length;
    const comp = exp > 0 ? Math.min(100, Math.round((n / exp) * 100)) : null, off = d.alertRecs.filter((x) => inR(x.t, r) && x.sev === 'offline' && x.title.startsWith(v.code)).length;
    return { v, comp, off };
  });
  const SC = { ok: 'Calibrated', due: 'Due', never: 'Not calibrated', failed: 'Failed' }, ss = d.sensors.filter((s) => ids.has(s.dev));
  return { summary: [['Devices', devs.length], ['Online now', devs.filter((v) => v.status === 'online').length], ['Offline / disconnected', devs.filter((v) => v.status !== 'online').length], ['Offline alerts', rows.reduce((s, x) => s + x.off, 0)]],
    sections: [{ title: 'Data completeness by device (%)', chart: { type: 'bar', unit: '%', cats: rows.map((x) => x.v.code), series: [{ name: 'Completeness', vals: rows.map((x) => x.comp ?? 0) }] } },
      { title: 'Device performance', columns: ['Device', 'Status', 'Last seen', 'Data completeness', 'Offline alerts', 'Battery', 'Wi-Fi', 'Firmware'], rows: rows.map(({ v, comp, off }) => [v.code, v.status, v.seen ? fmtDT(v.seen) : 'never', comp == null ? '—' : comp + '%', off, v.battery == null ? 'Mains' : Math.round(v.battery) + '%', v.rssi != null && v.status === 'online' ? v.rssi + ' dBm' : '—', v.fw || '—']) },
      { title: 'Sensor status', columns: ['Sensor', 'Type', 'ESP32', 'GPIO', 'Area', 'Connection', 'Calibration'], rows: ss.map((s) => [s.id, M[s.type].n, d.devices.find((v) => v.id === s.dev)?.code, 'GPIO' + s.pin, d.areas.find((a) => a.id === s.area)?.name || '—', sensorConn(d, s), SC[calibState(s)]]) }] };
}
function maint(d, areas, r) {
  const ids = new Set(areas.map((a) => a.dev)), devs = d.devices.filter((v) => ids.has(v.id)), ss = d.sensors.filter((s) => ids.has(s.dev));
  const ML = { ok: 'Operational', due: 'Service due', under: 'Under maintenance' }, SC = { ok: 'Calibrated', due: 'Due', never: 'Not calibrated', failed: 'Failed' };
  const act = (d.logs || []).filter((l) => inR(l.t, r) && logCat(l.msg) === 'Maintenance');
  return { summary: [['Devices needing maintenance', devs.filter((v) => v.maint !== 'ok').length], ['Low batteries (<20%)', devs.filter((v) => v.battery != null && v.battery < 20).length], ['Sensors needing calibration', ss.filter((s) => calibState(s) !== 'ok').length], ['Maintenance activities', act.length]],
    sections: [{ title: 'Device maintenance', columns: ['Device', 'Maintenance status', 'Status', 'Battery', 'Firmware', 'Last seen'], rows: devs.map((v) => [v.code, ML[v.maint], v.status, v.battery == null ? 'Mains' : Math.round(v.battery) + '%', v.fw || '—', v.seen ? fmtDT(v.seen) : 'never']) },
      { title: 'Sensor calibration', columns: ['Sensor', 'Type', 'ESP32', 'Area', 'Last calibration', 'Result', 'State'], rows: ss.map((s) => [s.id, M[s.type].n, d.devices.find((v) => v.id === s.dev)?.code, d.areas.find((a) => a.id === s.area)?.name || '—', s.calib ? fmtD(s.calib.t) : 'never', s.calib ? s.calib.result : '—', SC[calibState(s)]]) },
      { title: 'Maintenance records', columns: ['Date', 'Type', 'Target', 'By', 'Result', 'Notes'], rows: (d.maintLog || []).filter((x) => inR(x.t, r) && (ids.has(x.targetId) || ss.some((s) => s.id === x.targetId))).map((x) => [fmtDT(x.t), x.type, x.targetLabel, x.by, x.result || '—', x.notes || '—']) },
      { title: 'Maintenance activity in this period', columns: ['Time', 'By', 'Activity'], rows: act.map((l) => [fmtDT(l.t), l.by, l.msg]) }] };
}
function farm(d, areas, r) {
  const farms = d.farms.filter((f) => areas.some((a) => a.farm === f.id)), T = Date.now();
  const avg = (as, m) => { const s = stat(as.filter((a) => metricsOf(a).includes(m)).flatMap((a) => buckets(d, a.id, m, r.from, r.to))); return s ? f1(s.avg) + M[m].u : '—'; };
  const rows = farms.map((f) => {
    const as = areas.filter((a) => a.farm === f.id), ok = as.filter((a) => areaStatus(d, a) === 'normal').length, al = areaAlerts(d, as, r), dv = new Set(as.map((a) => a.dev).filter(Boolean));
    const sec = d.pumps.filter((p) => as.some((a) => a.id === p.area)).flatMap((p) => p.sessions).filter((x) => inR(x.start, r)).reduce((q, x) => q + x.sec, 0);
    return { f, as, ok, al, row: [f.name, as.filter((a) => a.kind === 'garden').length, as.filter((a) => a.kind === 'pond').length, `${ok}/${as.length}`, `${[...dv].filter((id) => d.devices.find((v) => v.id === id)?.status === 'online').length}/${dv.size}`, al.length, al.filter((x) => x.sev === 'critical').length, avg(as, 'moisture'), avg(as, 'temp'), avg(as, 'ph'), avg(as, 'turb'), mins(sec)] };
  });
  return { summary: [['Farms', farms.length], ['Monitoring areas', areas.length], ['Areas healthy now', `${areas.filter((a) => areaStatus(d, a) === 'normal').length}/${areas.length}`], ['Alerts in period', rows.reduce((s, x) => s + x.al.length, 0)]],
    sections: [{ title: 'Alerts by farm', chart: { type: 'bar', unit: 'alerts', cats: rows.map((x) => x.f.name), series: [{ name: 'Alerts', vals: rows.map((x) => x.al.length) }] } },
      { title: 'Farm summary', columns: ['Farm', 'Gardens', 'Ponds', 'Healthy now', 'Devices online', 'Alerts', 'Critical', 'Avg soil moisture', 'Avg water temp', 'Avg pH', 'Avg turbidity', 'Irrigation time'], rows: rows.map((x) => x.row) }] };
}
const BUILD = { soil, water, alerts, devices, maint, farm };

export function buildReport(d, type, r, filter, by) {
  const areas = pick(d, filter), title = REPORTS.find((x) => x[0] === type)[1];
  const lab = filter === 'all' ? 'All farms and areas' : filter.startsWith('farm:') ? d.farms.find((f) => f.id === filter.slice(5))?.name : d.areas.find((a) => a.id === filter)?.name;
  return { title, org: d.settings && d.settings.org, period: r.label, scope: lab || 'All', generated: fmtDT(Date.now()), by, note: 'Readings recorded before today are sample data in this prototype.', ...BUILD[type](d, areas, r) };
}

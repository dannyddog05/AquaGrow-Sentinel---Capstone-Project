import { KIND, DEFV, M } from './constants';
import { record } from './history';

/* Reading pipeline: every reading arrives as a "packet" and must pass authentication, duplicate, format and range
   checks before it is stored. A real backend would run the same checks on the HTTP/MQTT endpoint. */
export const rt = { live: false };          // set once the live feed has started (avoids false "missing data" alerts on page load)
export const VALID = { moisture: [0, 100], temp: [-5, 60], ph: [0, 14], turb: [0, 3000] };   // physically possible values
export const SPIKE = { moisture: 35, temp: 6, ph: 2, turb: 150 };                           // largest believable jump between readings
export const STALE_MS = 90000;               // a sensor on an online device that is silent this long is "missing"
export const FLAG_MS = 120000;               // how long a data-quality alert stays active after the last bad reading
const STEP = { moisture: 2.2, temp: 0.35, ph: 0.08, turb: 5 }, LIM = { moisture: [5, 95], temp: [22, 40], ph: [5, 9.8], turb: [2, 200] };
const BAD = { moisture: 140, temp: 120, ph: 25, turb: -5 };
const mets = (a) => (a.metrics && a.metrics.length ? a.metrics : KIND[a.kind]);
const uid = () => Math.random().toString(36).slice(2, 8);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const sysLog = (n, msg) => { n.logs = [{ id: 'l' + Date.now() + uid(), t: Date.now(), by: 'System', msg }, ...(n.logs || [])].slice(0, 500); };
export const genKey = () => { try { return Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return uid() + uid() + uid(); } };
export const newIngest = () => ({ stats: { accepted: 0, invalid: 0, duplicate: 0, unauthorized: 0, suspect: 0, backfilled: 0 }, seen: [], log: [], lastPkt: null });
export const cmpVer = (a, b) => { const x = String(a || '0').split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
/** Firmware 1.2.0 and newer keeps readings in flash while Wi-Fi is down. */
export const canBuffer = (v) => cmpVer(v.fw, '1.2.0') >= 0;
const flag = (n, key, info) => { n.qflags = n.qflags || {}; n.qflags[key] = { t: Date.now(), sev: 'warning', ...info }; };

export function ingest(n, pkt) {
  const I = n.ingest || (n.ingest = newIngest()), T = Date.now();
  const v = n.devices.find((x) => x.id === pkt.dev), a = n.areas.find((x) => x.id === pkt.area), s = n.sensors.find((x) => x.dev === pkt.dev && x.area === pkt.area && x.type === pkt.metric);
  const who = (v ? v.code : String(pkt.dev)) + ' · ' + (s ? s.id : pkt.metric), unit = M[pkt.metric] ? M[pkt.metric].u : '';
  const log = (reason, detail, result) => { I.log = [{ id: 'ig' + T + uid(), t: T, dev: v ? v.code : String(pkt.dev), sensor: s ? s.id : pkt.metric, area: a ? a.name : '—', value: pkt.value, reason, detail, result }, ...I.log].slice(0, 100); };
  const rej = (reason, detail, stat, key, info) => { I.stats[stat]++; log(reason, detail, 'Rejected'); if (s) s.rej = (s.rej || 0) + 1; if (key) flag(n, key, info); return { ok: false, reason, detail }; };
  if (!v || pkt.key !== v.key) return rej('Unauthenticated device', 'The device key is missing, wrong or revoked.', 'unauthorized', v ? 'q:auth:' + v.id : null,
    { areaIds: n.areas.filter((x) => x.dev === (v && v.id)).map((x) => x.id), title: `Rejected data from ${v ? v.code : 'an unknown device'}`, value: 'Wrong or revoked device key', range: 'Valid device key', rec: 'Provision the current key to the device. If you did not expect this, treat the device as compromised.' });
  if (I.seen.includes(pkt.id)) return rej('Duplicate record', 'This reading was already received and stored.', 'duplicate');
  const key = 'q:inv:' + (s ? s.id : pkt.area + pkt.metric), [lo, hi] = VALID[pkt.metric] || [-Infinity, Infinity];
  const bad = (detail) => rej('Invalid value', detail, 'invalid', key, { areaIds: a ? [a.id] : [], title: `${who} sent an invalid reading`, value: `${pkt.value}${unit}`, range: `${lo}–${hi}${unit}`, rec: 'Check the sensor wiring and calibration. Invalid readings are not stored.' });
  if (!a) return bad('The area for this reading no longer exists.');
  if (typeof pkt.value !== 'number' || !isFinite(pkt.value)) return bad('The value is not a number.');
  if (pkt.value < lo || pkt.value > hi) return bad(`Outside the possible range ${lo} to ${hi}${unit}.`);
  if (!(pkt.ts > 0) || pkt.ts > T + 60000) return bad('The timestamp is missing or in the future.');
  const prev = a.r[pkt.metric];
  if (!pkt.backfill && prev != null && Math.abs(pkt.value - prev) > SPIKE[pkt.metric]) {
    I.stats.suspect++; log('Sudden change', `Jumped from ${prev} to ${pkt.value}${unit}. Stored, but flagged.`, 'Accepted (flagged)');
    flag(n, 'q:spike:' + a.id + ':' + pkt.metric, { areaIds: [a.id], title: `Sudden change in ${M[pkt.metric].n.toLowerCase()}`, value: `${prev} → ${pkt.value}${unit}`, range: `Change of at most ${SPIKE[pkt.metric]}${unit} between readings`, rec: 'Check the sensor. A jump this large is usually a loose cable, air bubble or dirty probe.' });
  }
  I.seen = [pkt.id, ...I.seen].slice(0, 400);
  if (pkt.backfill) I.stats.backfilled++; else I.stats.accepted++;
  if (!pkt.backfill) { a.r[pkt.metric] = pkt.value; a.h[pkt.metric] = [...(a.h[pkt.metric] || []).slice(-39), { t: pkt.ts, v: pkt.value }]; a.rt = pkt.ts; }
  record(n, a.id, pkt.metric, pkt.value, pkt.ts);
  if (s && (!s.last || pkt.ts > s.last)) s.last = pkt.ts;
  I.lastPkt = pkt;
  return { ok: true };
}

/** One step of the simulated ESP32 feed: online devices send readings, Wi-Fi-dropped devices buffer them and retry. */
export function feedTick(n) {
  const T = Date.now(); n.ingest = n.ingest || newIngest();
  n.devices.forEach((v) => {
    const areas = n.areas.filter((a) => a.dev === v.id);
    const make = (base) => { const out = [];
      areas.forEach((a) => mets(a).forEach((m) => {
        const s = n.sensors.find((x) => x.dev === v.id && x.area === a.id && x.type === m); if (s && s.fault) return;
        const pumping = m === 'moisture' && (n.pumps || []).some((p) => p.area === a.id && p.state === 'on');
        const val = +clamp(base(a, m) + rnd(-STEP[m], STEP[m]) + (m === 'moisture' ? (pumping ? 4 : -0.2) : 0), ...LIM[m]).toFixed(1);
        v.seq = (v.seq || 0) + 1; out.push({ id: v.id + ':' + (s ? s.id : a.id + m) + ':' + v.seq, dev: v.id, area: a.id, metric: m, value: val, ts: Date.now(), key: v.devKey || v.key });
      })); return out; };
    if (v.status === 'online') {
      v.seen = T;
      if (v.battery != null) v.battery = +Math.max(0, v.battery - 0.02).toFixed(2);
      if (v.rssi != null) v.rssi = clamp(Math.round(v.rssi + rnd(-2, 2)), -90, -45);
      if (v.buffer && v.buffer.length) { const N = v.buffer.length; v.buffer.forEach((p) => ingest(n, { ...p, backfill: true })); v.buffer = []; v.lastFlush = { t: T, count: N }; sysLog(n, `${v.code}: synchronized ${N} stored readings after reconnecting`); }
      make((a, m) => a.r[m] ?? DEFV[m]).forEach((p) => ingest(n, p));
    } else if (v.drop) {
      if (canBuffer(v)) { v.buffer = v.buffer || []; v.bl = v.bl || {}; make((a, m) => v.bl[a.id + m] ?? a.r[m] ?? DEFV[m]).forEach((p) => { v.bl[p.area + p.metric] = p.value; v.buffer.push(p); }); if (v.buffer.length > 600) v.buffer.splice(0, v.buffer.length - 600); }
      if (v.autoReconnect !== false && T >= v.drop.retryAt) {
        v.drop.attempts++;
        if (v.drop.attempts >= 3 || Math.random() < 0.4) { v.status = 'online'; v.since = T; v.seen = T; v.drop = null; v.bl = null; sysLog(n, `${v.code} reconnected automatically`); }
        else v.drop.retryAt = T + Math.min(30000, 4000 * 2 ** v.drop.attempts);
      }
    }
  });
}

export function dropWifi(n, devId) {
  const v = n.devices.find((x) => x.id === devId); if (!v || v.status !== 'online') return false;
  v.status = 'offline'; v.drop = { since: Date.now(), attempts: 0, retryAt: Date.now() + 8000 }; v.buffer = v.buffer || []; return true;
}
/** Sends a test packet as if it came from the sensor's ESP32. */
export function testPacket(n, kind, s) {
  const v = n.devices.find((x) => x.id === s.dev), a = n.areas.find((x) => x.id === s.area);
  if (kind === 'duplicate') { const lp = n.ingest && n.ingest.lastPkt; return lp ? ingest(n, { ...lp }) : { ok: false, reason: 'No reading to repeat yet.' }; }
  if (!v || !a) return { ok: false, reason: 'This sensor is not assigned to an area.' };
  v.seq = (v.seq || 0) + 1;
  const cur = a.r[s.type] ?? DEFV[s.type], p = { id: `${v.id}:${s.id}:${v.seq}`, dev: v.id, area: a.id, metric: s.type, ts: Date.now(), key: v.devKey || v.key, value: cur };
  if (kind === 'invalid') p.value = BAD[s.type];
  if (kind === 'spike') p.value = +clamp(cur > VALID[s.type][1] / 2 ? cur - SPIKE[s.type] * 1.3 : cur + SPIKE[s.type] * 1.3, ...VALID[s.type]).toFixed(1);
  if (kind === 'badkey') p.key = 'ffffffffffffffff';
  return ingest(n, p);
}

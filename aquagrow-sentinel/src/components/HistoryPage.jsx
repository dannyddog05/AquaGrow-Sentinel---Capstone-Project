import { useState } from 'react';
import { M } from '../data/constants';
import { metricsOf, thOf } from '../data/db';
import { buckets, stat, readingRows, fmtDT, ymd } from '../data/reports';
import { chartSvg } from '../data/charts';
import { logCat } from '../data/history';
import { saveCSV } from '../data/exporters';
import { RangeBar, rangeOf, DataTable } from './ui';

const f1 = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
const Stat = ({ n, l }) => <div className="card stat"><div className="n" style={{ fontSize: 24 }}>{n}</div><div className="l">{l}</div></div>;
const areaNames = (d, ids) => ids.map((i) => d.areas.find((a) => a.id === i)?.name).filter(Boolean).join(', ') || 'System';

function Readings({ d }) {
  const [m, setM] = useState('moisture'), [ar, setAr] = useState('all'), [rv, setRv] = useState({ p: '7d', from: ymd(-7), to: ymd(0) });
  const r = rangeOf(rv), cand = d.areas.filter((a) => metricsOf(a).includes(m)), arv = cand.some((a) => a.id === ar) ? ar : 'all', areas = cand.filter((a) => arv === 'all' || a.id === arv);
  const cols = ['Time', 'Area', 'Sensor', 'ESP32', 'Average', 'Min', 'Max', 'Samples'];
  const rows = r.error ? [] : areas.flatMap((a) => readingRows(d, a, m, r.from, r.to)).sort((x, y) => y[0] - x[0]).map((x) => x.slice(1));
  const S = r.error ? null : stat(areas.flatMap((a) => buckets(d, a.id, m, r.from, r.to)));
  const th = areas.length === 1 ? thOf(d, areas[0])[m] || {} : {};
  const spec = { type: 'line', unit: M[m].u, series: r.error ? [] : areas.map((a) => ({ name: a.name, pts: buckets(d, a.id, m, r.from, r.to).map((b) => [b[0], b[1] / b[4]]) })).filter((s) => s.pts.length),
    bands: [{ y: th.wl, color: '#e08a00' }, { y: th.wh, color: '#e08a00' }, { y: th.cl, color: '#d6336c' }, { y: th.ch, color: '#d6336c' }].filter((b) => b.y != null) };
  return (
    <>
      <div className="bar2">
        <div className="acts">
          <select className="inp" aria-label="Sensor type" value={m} onChange={(e) => setM(e.target.value)}>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select>
          <select className="inp" aria-label="Farm area" value={arv} onChange={(e) => setAr(e.target.value)}><option value="all">All areas</option>{cand.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <RangeBar v={rv} set={setRv} />
        </div>
        <button className="btn" disabled={!rows.length} onClick={() => saveCSV([cols, ...rows], `readings_${m}.csv`)}>Export CSV</button>
      </div>
      {r.error && <div className="err" role="alert">{r.error}</div>}
      <div className="grid s5">
        <Stat n={S ? f1(S.avg) + M[m].u : '—'} l="Average" /><Stat n={S ? f1(S.min) + M[m].u : '—'} l="Minimum" /><Stat n={S ? f1(S.max) + M[m].u : '—'} l="Maximum" /><Stat n={S ? S.n.toLocaleString() : '—'} l="Readings stored" />
      </div>
      <div className="card"><h2>{M[m].n} history <small className="mut" style={{ fontWeight: 400 }}>{!r.error && (r.to - r.from <= 3 * 864e5 ? 'hourly averages' : 'daily averages')}</small></h2>
        <div className="rc" dangerouslySetInnerHTML={{ __html: chartSvg(spec) }} /></div>
      <div className="card"><h2>Readings</h2><DataTable columns={cols} rows={rows} /></div>
      <p className="mut" style={{ fontSize: 13 }}>Readings are stored as hourly and daily summaries to keep browser storage small. Data from before you started using this prototype is sample data.</p>
    </>
  );
}

function Alerts({ d }) {
  const [sev, setSev] = useState('all'), [st, setSt] = useState('all'), [ar, setAr] = useState('all'), [rv, setRv] = useState({ p: '90d', from: ymd(-30), to: ymd(0) });
  const r = rangeOf(rv);
  const L = r.error ? [] : d.alertRecs.filter((x) => x.t >= r.from && x.t < r.to && (sev === 'all' || x.sev === sev) && (st === 'all' || x.status === st) && (ar === 'all' || x.areaIds.includes(ar))).sort((a, b) => b.t - a.t);
  const cols = ['Detected', 'Area', 'Alert', 'Severity', 'Reading', 'Expected', 'Acknowledged', 'Resolved', 'Assigned / handled by', 'Actions taken'];
  const plain = L.map((x) => [fmtDT(x.t), areaNames(d, x.areaIds), x.title, x.sev, x.value0, x.range, x.ackAt ? `${fmtDT(x.ackAt)} (${x.ackBy})` : 'No', x.resolvedAt ? `${fmtDT(x.resolvedAt)} (${x.resolvedBy})` : x.status === 'ack' ? 'Acknowledged, open' : 'Open', x.assignee || x.ackBy || x.resolvedBy || '—', x.tl.filter((e) => e.type === 'action').map((e) => e.text).join('; ') || '—']);
  const view = plain.map((p, i) => p.map((c, j) => (j === 3 ? <span className={`pill ${L[i].sev}`}>{c}</span> : c)));
  return (
    <>
      <div className="bar2">
        <div className="acts">
          <select className="inp" aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option></select>
          <select className="inp" aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="ack">Acknowledged</option><option value="resolved">Resolved</option></select>
          <select className="inp" aria-label="Area" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <RangeBar v={rv} set={setRv} all />
        </div>
        <button className="btn" disabled={!L.length} onClick={() => saveCSV([cols, ...plain], 'alert_history.csv')}>Export CSV</button>
      </div>
      {r.error && <div className="err" role="alert">{r.error}</div>}
      <div className="card"><h2>Alert history <span className="pill offline">{L.length}</span></h2><DataTable columns={cols} rows={view} step={25} /></div>
    </>
  );
}

function Activity({ d }) {
  const [cat, setCat] = useState('all'), [who, setWho] = useState('all'), [q, setQ] = useState(''), [rv, setRv] = useState({ p: '90d', from: ymd(-30), to: ymd(0) });
  const r = rangeOf(rv), logs = d.logs || [], users = [...new Set(logs.map((l) => l.by))];
  const cats = [...new Set(logs.map((l) => logCat(l.msg)))].sort();
  const L = r.error ? [] : logs.filter((l) => l.t >= r.from && l.t < r.to && (cat === 'all' || logCat(l.msg) === cat) && (who === 'all' || l.by === who) && (!q || l.msg.toLowerCase().includes(q.toLowerCase())));
  const cols = ['Time', 'User', 'Category', 'Activity'], rows = L.map((l) => [fmtDT(l.t), l.by, logCat(l.msg), l.msg]);
  return (
    <>
      <div className="bar2">
        <div className="acts">
          <select className="inp" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="inp" aria-label="User" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">All users</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
          <input className="inp" type="search" placeholder="Search activity" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <RangeBar v={rv} set={setRv} all />
        </div>
        <button className="btn" disabled={!rows.length} onClick={() => saveCSV([cols, ...rows], 'activity_log.csv')}>Export CSV</button>
      </div>
      {r.error && <div className="err" role="alert">{r.error}</div>}
      <div className="card"><h2>Activity log <span className="pill offline">{L.length}</span></h2><DataTable columns={cols} rows={rows} step={50} /></div>
    </>
  );
}

export default function HistoryPage({ d, user }) {
  const [tab, setTab] = useState('read'), tabs = [['read', 'Sensor readings'], ['alerts', 'Alert history'], ...(user.role === 'Owner' ? [['act', 'Activity log']] : [])];
  return (
    <div className="pg">
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'read' && <Readings d={d} />}{tab === 'alerts' && <Alerts d={d} />}{tab === 'act' && user.role === 'Owner' && <Activity d={d} />}
    </div>
  );
}

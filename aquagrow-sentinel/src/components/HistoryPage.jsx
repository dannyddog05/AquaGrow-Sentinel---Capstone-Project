import { useState } from 'react';
import { M } from '../data/constants';
import { metricsOf, thOf } from '../data/db';
import { buckets, stat, readingRows, fmtDT, ymd } from '../data/reports';
import { chartSvg } from '../data/charts';
import { logCat } from '../data/history';
import { saveCSV } from '../data/exporters';
import { ACTS, BAR2, BTN, CARD, CARD_H2, DataTable, ERR_TXT, INNER_TABS, INP, PG, RangeBar, StatCard, StatStrip, StatusBadge, innerTab, rangeOf } from './ui';

const f1 = (v) => (v == null ? '—' : String(Math.round(v * 10) / 10));
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
      <div className={BAR2}>
        <div className={ACTS}>
          <select className={INP} aria-label="Sensor type" value={m} onChange={(e) => setM(e.target.value)}>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}</select>
          <select className={INP} aria-label="Farm area" value={arv} onChange={(e) => setAr(e.target.value)}><option value="all">All areas</option>{cand.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <RangeBar v={rv} set={setRv} />
        </div>
        <button className={BTN} disabled={!rows.length} onClick={() => saveCSV([cols, ...rows], `readings_${m}.csv`)}>Export CSV</button>
      </div>
      {r.error && <div className={ERR_TXT} role="alert">{r.error}</div>}
      <StatStrip>
        <StatCard value={S ? f1(S.avg) + M[m].u : '—'} label="Average" /><StatCard value={S ? f1(S.min) + M[m].u : '—'} label="Minimum" /><StatCard value={S ? f1(S.max) + M[m].u : '—'} label="Maximum" /><StatCard value={S ? S.n.toLocaleString() : '—'} label="Readings stored" />
      </StatStrip>
      <div className={CARD}>
        <h2 className={CARD_H2}>
          {M[m].n} history <small className="text-mut font-sans font-normal">{!r.error && (r.to - r.from <= 3 * 864e5 ? 'hourly averages' : 'daily averages')}</small>
        </h2>
        <div className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:block" dangerouslySetInnerHTML={{ __html: chartSvg(spec) }} />
      </div>
      <div className={CARD}><h2 className={CARD_H2}>Readings</h2><DataTable columns={cols} rows={rows} /></div>
      <p className="text-mut text-[13px]">Readings are stored as hourly and daily summaries to keep browser storage small. Data from before you started using this prototype is sample data.</p>
    </>
  );
}

function Alerts({ d }) {
  const [sev, setSev] = useState('all'), [st, setSt] = useState('all'), [ar, setAr] = useState('all'), [rv, setRv] = useState({ p: '90d', from: ymd(-30), to: ymd(0) });
  const r = rangeOf(rv);
  const L = r.error ? [] : d.alertRecs.filter((x) => x.t >= r.from && x.t < r.to && (sev === 'all' || x.sev === sev) && (st === 'all' || x.status === st) && (ar === 'all' || x.areaIds.includes(ar))).sort((a, b) => b.t - a.t);
  const cols = ['Detected', 'Area', 'Alert', 'Severity', 'Reading', 'Expected', 'Acknowledged', 'Resolved', 'Assigned / handled by', 'Actions taken'];
  const plain = L.map((x) => [fmtDT(x.t), areaNames(d, x.areaIds), x.title, x.sev, x.value0, x.range, x.ackAt ? `${fmtDT(x.ackAt)} (${x.ackBy})` : 'No', x.resolvedAt ? `${fmtDT(x.resolvedAt)} (${x.resolvedBy})` : x.status === 'ack' ? 'Acknowledged, open' : 'Open', x.assignee || x.ackBy || x.resolvedBy || '—', x.tl.filter((e) => e.type === 'action').map((e) => e.text).join('; ') || '—']);
  const view = plain.map((p, i) => p.map((c, j) => (j === 3 ? <StatusBadge status={L[i].sev}>{c}</StatusBadge> : c)));
  return (
    <>
      <div className={BAR2}>
        <div className={ACTS}>
          <select className={INP} aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="offline">Offline</option></select>
          <select className={INP} aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="ack">Acknowledged</option><option value="resolved">Resolved</option></select>
          <select className={INP} aria-label="Area" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All areas</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <RangeBar v={rv} set={setRv} all />
        </div>
        <button className={BTN} disabled={!L.length} onClick={() => saveCSV([cols, ...plain], 'alert_history.csv')}>Export CSV</button>
      </div>
      {r.error && <div className={ERR_TXT} role="alert">{r.error}</div>}
      <div className={CARD}><h2 className={CARD_H2}>Alert history <StatusBadge status="offline">{L.length}</StatusBadge></h2><DataTable columns={cols} rows={view} step={25} /></div>
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
      <div className={BAR2}>
        <div className={ACTS}>
          <select className={INP} aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
          <select className={INP} aria-label="User" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">All users</option>{users.map((u) => <option key={u}>{u}</option>)}</select>
          <input className={INP} type="search" placeholder="Search activity" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <RangeBar v={rv} set={setRv} all />
        </div>
        <button className={BTN} disabled={!rows.length} onClick={() => saveCSV([cols, ...rows], 'activity_log.csv')}>Export CSV</button>
      </div>
      {r.error && <div className={ERR_TXT} role="alert">{r.error}</div>}
      <div className={CARD}><h2 className={CARD_H2}>Activity log <StatusBadge status="offline">{L.length}</StatusBadge></h2><DataTable columns={cols} rows={rows} step={50} /></div>
    </>
  );
}

export function ActivityLogsPage({ d, user }) {
  if (user.role !== 'Owner') return <div className={PG}><div className={CARD}><p className="text-mut">Only owners can view the activity log.</p></div></div>;
  return <div className={PG}><Activity d={d} /></div>;
}

export default function HistoryPage({ d, user, hideLogs = false }) {
  const [tab, setTab] = useState('read'), tabs = [['read', 'Sensor readings'], ['alerts', 'Alert history'], ...(!hideLogs && user.role === 'Owner' ? [['act', 'Activity log']] : [])];
  return (
    <div className={PG}>
      <div className={INNER_TABS} role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={innerTab(tab === k)} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'read' && <Readings d={d} />}{tab === 'alerts' && <Alerts d={d} />}{!hideLogs && tab === 'act' && user.role === 'Owner' && <Activity d={d} />}
    </div>
  );
}

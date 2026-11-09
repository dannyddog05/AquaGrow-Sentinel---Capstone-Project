import { useMemo, useState } from 'react';
import { can } from '../data/db';
import { buildReport, periodRange, REPORTS, PERIODS, ymd } from '../data/reports';
import { chartSvg, svgToPng } from '../data/charts';
import { saveCSV, reportRows, saveXLSX, savePDF } from '../data/exporters';
import { DataTable } from './ui';
import logoUrl from '../assets/logo.png';

const toDataUrl = async (url) => { const b = await (await fetch(url)).blob(); return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }); };
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');

export default function ReportsPage({ d, user }) {
  const [type, setType] = useState('soil'), [kind, setKind] = useState('weekly'), [v, setV] = useState({ date: ymd(0), month: ymd(0).slice(0, 7), year: String(new Date().getFullYear()), from: ymd(-6), to: ymd(0) });
  const [filter, setFilter] = useState('all'), [busy, setBusy] = useState(''), [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const range = periodRange(kind, v);
  const rep = useMemo(() => (range.error ? null : buildReport(d, type, range, filter, user.name)), [d, type, filter, range.from, range.to, range.error]);

  const run = async (fmt) => {
    setBusy(fmt);
    try {
      const base = `AquaGrow_${type}_${slug(rep.period)}`;
      if (fmt === 'csv') saveCSV(reportRows(rep), base + '.csv');
      else if (fmt === 'xlsx') await saveXLSX(rep, base + '.xlsx');
      else {
        const charts = await Promise.all(rep.sections.map((s) => (s.chart ? svgToPng(chartSvg(s.chart), 720, 260) : null)));
        await savePDF(rep, base + '.pdf', charts, await toDataUrl(logoUrl).catch(() => null));
      }
      say(`${fmt.toUpperCase()} exported.`);
    } catch (e) { say(`Export failed: ${e.message || 'unknown error'}`); } finally { setBusy(''); }
  };

  return (
    <div className="pg">
      <div className="card">
        <div className="fg" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <label className="fld">Report<select value={type} onChange={(e) => setType(e.target.value)}>{REPORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="fld">Period<select value={kind} onChange={(e) => setKind(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {(kind === 'daily' || kind === 'weekly') && <label className="fld">{kind === 'daily' ? 'Date' : 'Any day in the week'}<input type="date" value={v.date} onChange={set('date')} /></label>}
          {kind === 'monthly' && <label className="fld">Month<input type="month" value={v.month} onChange={set('month')} /></label>}
          {kind === 'yearly' && <label className="fld">Year<input type="number" value={v.year} onChange={set('year')} /></label>}
          {kind === 'custom' && <><label className="fld">From<input type="date" value={v.from} onChange={set('from')} /></label><label className="fld">To<input type="date" value={v.to} onChange={set('to')} /></label></>}
          <label className="fld">Farm or area<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All farms and areas</option>{d.farms.map((f) => <option key={f.id} value={'farm:' + f.id}>Farm: {f.name}</option>)}{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        </div>
        {range.error && <div className="err" role="alert">{range.error}</div>}
      </div>

      {rep && <>
        <div className="bar2">
          <div><h2 style={{ fontSize: 20 }}>{rep.title}</h2><div className="mut" style={{ fontSize: 13 }}>{rep.period} · {rep.scope}</div></div>
          <div className="acts">
            {[['pdf', 'Export PDF'], ['xlsx', 'Export Excel'], ['csv', 'Export CSV']].map(([k, l]) => <button key={k} className={`btn${k === 'pdf' ? ' p' : ''}`} disabled={!!busy || !can(user, 'export')} onClick={() => run(k)}>{busy === k && <span className="spin" style={{ borderColor: '#0003', borderTopColor: '#1f6f3a' }} />}{busy === k ? 'Preparing…' : l}</button>)}
          </div>
        </div>
        <div className="grid s5">
          {rep.summary.map(([k, val]) => <div className="card stat" key={k}><div className="n">{val}</div><div className="l">{k}</div></div>)}
        </div>
        {rep.sections.map((s, i) => (
          <div className="card" key={i}>
            <h2>{s.title}</h2>
            {s.chart && <div className="rc" dangerouslySetInnerHTML={{ __html: chartSvg(s.chart) }} />}
            {s.columns && <DataTable columns={s.columns} rows={s.rows} step={25} />}
            {s.note && <small className="mut">{s.note}</small>}
          </div>
        ))}
        <p className="mut" style={{ fontSize: 13 }}>{rep.note} Exports include every row; the PDF shows at most 200 rows per table.</p>
      </>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

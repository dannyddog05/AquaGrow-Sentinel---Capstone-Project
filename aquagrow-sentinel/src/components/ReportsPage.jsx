import { useMemo, useState } from 'react';
import { can } from '../data/db';
import { buildReport, periodRange, REPORTS, PERIODS, ymd } from '../data/reports';
import { chartSvg, svgToPng } from '../data/charts';
import { saveCSV, reportRows, saveXLSX, savePDF } from '../data/exporters';
import { ACTS, BAR2, BTN, BTN_P, CARD, CARD_H2, DataTable, ERR_TXT, Field, PG, StatCard, StatStrip } from './ui';
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
    <div className={PG}>
      <div className={CARD}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-3">
          <Field label="Report"><select value={type} onChange={(e) => setType(e.target.value)}>{REPORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Period"><select value={kind} onChange={(e) => setKind(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          {(kind === 'daily' || kind === 'weekly') && <Field label={kind === 'daily' ? 'Date' : 'Any day in the week'}><input type="date" value={v.date} onChange={set('date')} /></Field>}
          {kind === 'monthly' && <Field label="Month"><input type="month" value={v.month} onChange={set('month')} /></Field>}
          {kind === 'yearly' && <Field label="Year"><input type="number" value={v.year} onChange={set('year')} /></Field>}
          {kind === 'custom' && <><Field label="From"><input type="date" value={v.from} onChange={set('from')} /></Field><Field label="To"><input type="date" value={v.to} onChange={set('to')} /></Field></>}
          <Field label="Farm or area"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All farms and areas</option>{d.farms.map((f) => <option key={f.id} value={'farm:' + f.id}>Farm: {f.name}</option>)}{d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        </div>
        {range.error && <div className={ERR_TXT} role="alert">{range.error}</div>}
      </div>

      {rep && (
        <>
          <div className={BAR2}>
            <div>
              <h2 className="text-[20px] font-bold font-display">{rep.title}</h2>
              <div className="text-mut text-[13px]">{rep.period} · {rep.scope}</div>
            </div>
            <div className={ACTS}>
              {[['pdf', 'Export PDF'], ['xlsx', 'Export Excel'], ['csv', 'Export CSV']].map(([k, l]) => (
                <button key={k} className={k === 'pdf' ? BTN_P : BTN} disabled={!!busy || !can(user, 'export')} onClick={() => run(k)}>
                  {busy === k && (
                    <span className={`w-4 h-4 border-[3px] rounded-full inline-block animate-spin align-[-3px] mr-1.5 ${k === 'pdf' ? 'border-white/30 border-t-white' : 'border-black/20 border-t-brand-dark'}`} />
                  )}
                  {busy === k ? 'Preparing…' : l}
                </button>
              ))}
            </div>
          </div>
          <StatStrip>
            {rep.summary.map(([k, val]) => (
              <StatCard key={k} value={val} label={k} />
            ))}
          </StatStrip>
          {rep.sections.map((s, i) => (
            <div className={CARD} key={i}>
              <h2 className={CARD_H2}>{s.title}</h2>
              {s.chart && <div className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:block" dangerouslySetInnerHTML={{ __html: chartSvg(s.chart) }} />}
              {s.columns && <DataTable columns={s.columns} rows={s.rows} step={25} />}
              {s.note && <small className="text-mut">{s.note}</small>}
            </div>
          ))}
          <p className="text-mut text-[13px]">{rep.note} Exports include every row; the PDF shows at most 200 rows per table.</p>
        </>
      )}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2.5 rounded-[10px] z-20 text-[14px] shadow-lg"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export const csvOf = (rows) => rows.map((r) => r.map((c) => { const s = c == null ? '' : String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export const saveCSV = (rows, name) => download(new Blob(['\ufeff' + csvOf(rows)], { type: 'text/csv;charset=utf-8' }), name);

export function reportRows(rep) {
  const rows = [[rep.title], ['Period', rep.period], ['Scope', rep.scope], ['Generated', rep.generated + (rep.by ? ' by ' + rep.by : '')], [], ['Summary']];
  rep.summary.forEach((s) => rows.push(s));
  rep.sections.forEach((s) => { if (!s.columns) return; rows.push([], [s.title], s.columns); s.rows.forEach((r) => rows.push(r)); });
  return rows;
}
const sheetName = (s, used) => { let n = s.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 28).trim() || 'Sheet', k = n, i = 2; while (used.has(k)) k = n.slice(0, 26) + ' ' + i++; used.add(k); return k; };
export async function buildXlsx(rep) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const b = (v) => ({ value: String(v), fontWeight: 'bold' }), c = (v) => ({ value: v == null ? '' : String(v) }), used = new Set();
  const sheets = [{ sheet: sheetName('Summary', used), data: [[b(rep.title)], [c('Period'), c(rep.period)], [c('Scope'), c(rep.scope)], [c('Generated'), c(rep.generated)], [c('Note'), c(rep.note)], [c('')], ...rep.summary.map(([k, v]) => [b(k), c(v)])] }];
  rep.sections.filter((s) => s.columns).forEach((s) => sheets.push({ sheet: sheetName(s.title, used), data: [s.columns.map(b), ...(s.rows.length ? s.rows : [['No data']]).map((r) => r.map(c))], stickyRowsCount: 1 }));
  return writeExcelFile(sheets).toBlob();
}
export const saveXLSX = async (rep, name) => download(await buildXlsx(rep), name);

const t = (s) => String(s ?? '').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/→/g, '->').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, '?');
/** charts: array aligned with rep.sections of PNG data URLs (or null). */
export async function buildPdf(rep, charts = [], logo) {
  const { jsPDF } = await import('jspdf'), autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }), PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight(), M = 36;
  let y = M;
  if (logo) { try { doc.addImage(logo, 'PNG', M, y, 40, 40); } catch (e) {} }
  doc.setFontSize(18).setTextColor(31, 111, 58).text(t(rep.title), M + (logo ? 50 : 0), y + 16);
  doc.setFontSize(10).setTextColor(93, 122, 114).text(t(`${rep.org || 'AquaGrow Sentinel'}  |  ${rep.period}  |  ${rep.scope}`), M + (logo ? 50 : 0), y + 32);
  doc.text(t(`Generated ${rep.generated}${rep.by ? ' by ' + rep.by : ''}`), M + (logo ? 50 : 0), y + 44);
  y += 60;
  const last = () => (doc.lastAutoTable ? doc.lastAutoTable.finalY : y);
  autoTable(doc, { startY: y, head: [['Summary', '']], body: rep.summary.map(([k, v]) => [t(k), t(v)]), theme: 'grid', headStyles: { fillColor: [47, 158, 68] }, styles: { fontSize: 9 }, margin: { left: M, right: M }, tableWidth: 360 });
  y = last() + 18;
  rep.sections.forEach((s, i) => {
    if (y > PH - 120) { doc.addPage(); y = M; }
    doc.setFontSize(12).setTextColor(18, 48, 42).text(t(s.title), M, y); y += 8;
    if (charts[i]) { const w = PW - 2 * M, h = (w * 260) / 720; if (y + h > PH - M) { doc.addPage(); y = M; } doc.addImage(charts[i], 'PNG', M, y, w, h); y += h + 10; }
    if (s.columns) {
      const rows = s.rows.slice(0, 200).map((r) => r.map(t));
      autoTable(doc, { startY: y, head: [s.columns.map(t)], body: rows.length ? rows : [[t('No data')]], theme: 'striped', headStyles: { fillColor: [28, 126, 214] }, styles: { fontSize: 8, cellPadding: 3 }, margin: { left: M, right: M } });
      y = last() + 6;
      if (s.rows.length > 200) { doc.setFontSize(8).setTextColor(93, 122, 114).text(t(`Showing the first 200 of ${s.rows.length} rows. Export to Excel or CSV for all rows.`), M, y + 8); y += 14; }
      y += 12;
    }
  });
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setFontSize(8).setTextColor(130).text(t(`${rep.note}   Page ${p} of ${n}`), M, PH - 16); }
  return doc;
}
export async function savePDF(rep, name, charts, logo) { (await buildPdf(rep, charts, logo)).save(name); }

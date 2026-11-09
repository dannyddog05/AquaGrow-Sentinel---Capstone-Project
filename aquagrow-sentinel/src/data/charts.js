const PAL = ['#1c7ed6', '#2f9e44', '#e08a00', '#d6336c', '#7048e8', '#0ca678'];
const D = 864e5;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
const fx = (t, span) => (span <= 2 * D ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(t).toLocaleDateString('en', span <= 120 * D ? { month: 'short', day: 'numeric' } : { month: 'short', year: '2-digit' }));
const FONT = "font-family=\"Arial, Helvetica, sans-serif\" font-size=\"11\"";

/** Returns an SVG string. spec: {type:'line'|'bar', series:[{name,pts:[[t,v]]} | {name,vals}], cats?, unit, bands?:[{y,color}]} */
export function chartSvg(spec, W = 720, H = 260) {
  const { type = 'line', series = [], unit = '', bands = [], cats } = spec;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  const vals = series.flatMap((s) => (cats ? s.vals : s.pts.map((p) => p[1])));
  if (!vals.length) return `${head}<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#5d7a72" ${FONT}>No data for this period</text></svg>`;
  const P = { l: 48, r: 14, t: series.length > 1 ? 30 : 12, b: 30 }, iw = W - P.l - P.r, ih = H - P.t - P.b;
  let lo = type === 'bar' ? 0 : Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; if (type !== 'bar') lo -= pad; hi += pad;
  const bs = bands.filter((b) => b.y > lo && b.y < hi);
  const Y = (v) => P.t + ih - ((v - lo) / (hi - lo)) * ih;
  let out = head + `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4; out += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#dbe8e2"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#5d7a72" ${FONT}>${num(v)}</text>`; }
  bs.forEach((b) => { out += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(b.y)}" y2="${Y(b.y)}" stroke="${b.color}" stroke-dasharray="5 4"/>`; });
  if (type === 'bar') {
    const labels = cats || series[0].pts.map((p) => p[0]), v0 = cats ? series[0].vals : series[0].pts.map((p) => p[1]), n = labels.length, bw = Math.min(46, (iw / n) * 0.7);
    const span = cats ? 0 : series[0].pts[n - 1][0] - series[0].pts[0][0], step = Math.ceil(n / 8);
    v0.forEach((v, i) => { const x = P.l + (iw / n) * (i + 0.5); out += `<rect x="${x - bw / 2}" y="${Y(v)}" width="${bw}" height="${Math.max(0, Y(0) - Y(v))}" fill="#1c7ed6" rx="2"/>`;
      if (i % step === 0) out += `<text x="${x}" y="${H - 10}" text-anchor="middle" fill="#5d7a72" ${FONT}>${esc(cats ? labels[i] : fx(labels[i], Math.max(span, 3 * D)))}</text>`; });
  } else {
    const all = series.flatMap((s) => s.pts.map((p) => p[0])), t0 = Math.min(...all);
    let t1 = Math.max(...all); if (t1 === t0) t1 = t0 + 1;
    const X = (t) => P.l + ((t - t0) / (t1 - t0)) * iw;
    for (let i = 0; i <= 4; i++) { const t = t0 + ((t1 - t0) * i) / 4; out += `<text x="${X(t)}" y="${H - 10}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" fill="#5d7a72" ${FONT}>${fx(t, t1 - t0)}</text>`; }
    series.forEach((s, i) => { const c = PAL[i % PAL.length];
      out += `<polyline fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" points="${s.pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/>`;
      if (s.pts.length === 1) out += `<circle cx="${X(s.pts[0][0])}" cy="${Y(s.pts[0][1])}" r="3" fill="${c}"/>`; });
  }
  if (series.length > 1) series.forEach((s, i) => { out += `<rect x="${P.l + i * 150}" y="8" width="10" height="10" fill="${PAL[i % PAL.length]}" rx="2"/><text x="${P.l + i * 150 + 15}" y="17" fill="#12302a" ${FONT}>${esc(s.name)}</text>`; });
  if (unit) out += `<text x="4" y="${P.t - 2}" fill="#5d7a72" ${FONT}>${esc(unit.trim())}</text>`;
  return out + '</svg>';
}

export function svgToPng(svg, w, h, scale = 2) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); };
    img.onerror = () => rej(new Error('Could not draw the chart'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

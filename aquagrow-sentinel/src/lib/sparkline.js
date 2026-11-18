/**
 * Pure SVG path builder for sparklines.
 * Filters non-finite numbers, scales to min/max with 10% vertical padding,
 * draws a flat mid-height line when max === min, and returns a dashed-line fallback
 * when fewer than 2 valid points exist. Never emits NaN.
 *
 * @param {number[]} values - Ordered samples (oldest first)
 * @param {number} [w=120] - ViewBox width
 * @param {number} [h=32] - ViewBox height
 * @returns {{ d: string, lastPoint: { x: number, y: number } | null, hasData: boolean }}
 */
export function buildPath(values, w = 120, h = 32) {
  const width = Number.isFinite(w) && w > 0 ? w : 120;
  const height = Number.isFinite(h) && h > 0 ? h : 32;
  const clean = Array.isArray(values)
    ? values.filter((v) => typeof v === 'number' && Number.isFinite(v))
    : [];

  const midY = +(height / 2).toFixed(2);
  if (clean.length < 2) {
    return {
      d: `M 0 ${midY} L ${width} ${midY}`,
      lastPoint: null,
      hasData: false,
    };
  }

  const padY = height * 0.1;
  const innerH = height - padY * 2;
  let min = clean[0];
  let max = clean[0];
  for (let i = 1; i < clean.length; i++) {
    if (clean[i] < min) min = clean[i];
    if (clean[i] > max) max = clean[i];
  }

  const span = max - min;
  const stepX = width / (clean.length - 1);

  const pts = clean.map((v, i) => {
    const x = +(i * stepX).toFixed(2);
    const y = span === 0 ? midY : +(height - padY - ((v - min) / span) * innerH).toFixed(2);
    return { x, y };
  });

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return {
    d,
    lastPoint: pts[pts.length - 1],
    hasData: true,
  };
}


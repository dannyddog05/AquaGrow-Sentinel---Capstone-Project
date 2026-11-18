import { useMemo, useRef } from 'react';
import { M } from '../data/constants';
import { devOf, level, metricsOf, thOf } from '../data/db';
import { STALE_MS, rt } from '../data/ingest';

/**
 * Decimal precision per metric key:
 * pH 1, DO 1, temp 1, turbidity 0, ammonia 2, moisture/% 0
 */
const DECIMALS = {
  ph: 1,
  do: 1,
  temp: 1,
  turb: 0,
  ammonia: 2,
  moisture: 0,
};

/**
 * Pure status resolver reusing existing app rules:
 * - offline: unassigned device, device not online, sensor fault, or silent past STALE_MS once live
 * - nodata: value is null/undefined/non-finite
 * - critical / warning / normal: delegated directly to existing `level()` from src/data/db.js
 *
 * @param {object} d - Scoped database snapshot
 * @param {object} area - Area record
 * @param {string} metricKey - Metric identifier (e.g. 'ph', 'temp', 'turb', 'moisture')
 * @param {number | null} value - Current reading value
 * @returns {'normal' | 'warning' | 'critical' | 'offline' | 'nodata'}
 */
export function getReadingStatus(d, area, metricKey, value) {
  const dv = devOf(d, area);
  if (!dv || dv.status !== 'online') return 'offline';

  const sensor = (d.sensors || []).find(
    (s) => s.dev === dv.id && s.area === area.id && s.type === metricKey
  );
  if (sensor) {
    if (sensor.fault) return 'offline';
    if (rt.live && sensor.last && Date.now() - sensor.last > STALE_MS) return 'offline';
  }

  if (value == null || !Number.isFinite(value)) return 'nodata';
  return level(metricKey, value, thOf(d, area));
}

/**
 * Formats safe range caption from safeMin / safeMax + unit.
 * Returns null when neither bound exists.
 */
export function formatSafeRange(safeMin, safeMax, unit) {
  const u = unit ? ` ${unit}` : '';
  if (safeMin != null && safeMax != null) return `Safe ${safeMin}–${safeMax}${u}`;
  if (safeMin != null) return `Safe ≥ ${safeMin}${u}`;
  if (safeMax != null) return `Safe ≤ ${safeMax}${u}`;
  return null;
}

/**
 * Builds MetricView[] for a single area from the existing DB state.
 * Metrics missing from the area's configured sensors are omitted (never faked).
 */
export function buildAreaMetrics(d, area) {
  if (!d || !area) return [];
  const thresholds = thOf(d, area);
  const keys = metricsOf(area).filter((k) => Boolean(M[k]));

  return keys.map((key) => {
    const meta = M[key];
    const rawVal = area.r ? area.r[key] : undefined;
    const value = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;
    const th = thresholds[key] || {};
    const safeMin = th.wl ?? null;
    const safeMax = th.wh ?? null;
    const rawHist = (area.h && Array.isArray(area.h[key]) ? area.h[key] : []).slice(-30);
    const history = rawHist
      .map((p) => (typeof p === 'number' ? p : p?.v))
      .filter((v) => typeof v === 'number' && Number.isFinite(v));

    return {
      key,
      label: meta.n,
      unit: (meta.u || '').trim(),
      value,
      decimals: DECIMALS[key] ?? 1,
      status: getReadingStatus(d, area, key, value),
      safeMin,
      safeMax,
      history,
    };
  });
}

function sameMetric(a, b) {
  if (!a || !b) return false;
  if (
    a.key !== b.key ||
    a.label !== b.label ||
    a.unit !== b.unit ||
    a.value !== b.value ||
    a.decimals !== b.decimals ||
    a.status !== b.status ||
    a.safeMin !== b.safeMin ||
    a.safeMax !== b.safeMax ||
    a.history.length !== b.history.length
  ) {
    return false;
  }
  for (let i = 0; i < a.history.length; i++) {
    if (a.history[i] !== b.history[i]) return false;
  }
  return true;
}

/**
 * Selector hook returning shallow-stable MetricView[] for an area.
 * Unchanged MetricView objects preserve referential identity across ticks so React.memo cards skip re-renders.
 *
 * @param {object} d - Scoped database snapshot
 * @param {string} areaId - Target area ID
 * @returns {Array<{
 *   key: string,
 *   label: string,
 *   unit: string,
 *   value: number | null,
 *   decimals: number,
 *   status: 'normal' | 'warning' | 'critical' | 'offline' | 'nodata',
 *   safeMin: number | null,
 *   safeMax: number | null,
 *   history: number[]
 * }>}
 */
export function useAreaMetrics(d, areaId) {
  const cacheRef = useRef(new Map());

  return useMemo(() => {
    const area = d?.areas?.find((a) => a.id === areaId);
    const fresh = buildAreaMetrics(d, area);
    const prevMap = cacheRef.current;
    const nextMap = new Map();

    const stable = fresh.map((item) => {
      const prev = prevMap.get(item.key);
      const chosen = prev && sameMetric(prev, item) ? prev : item;
      nextMap.set(item.key, chosen);
      return chosen;
    });

    cacheRef.current = nextMap;
    return stable;
  }, [d, areaId]);
}


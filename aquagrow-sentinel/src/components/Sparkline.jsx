import { memo, useMemo } from 'react';
import { buildPath } from '../lib/sparkline';

const STROKE_CLASS = {
  normal: 'text-status-normal-line',
  warning: 'text-status-warning-line',
  critical: 'text-status-critical-line',
  offline: 'text-status-offline-line',
  nodata: 'text-status-offline-line',
};

const Sparkline = memo(function Sparkline({ values, status = 'normal' }) {
  const { d, lastPoint, hasData } = useMemo(() => buildPath(values, 120, 32), [values]);
  const colorClass = STROKE_CLASS[status] || STROKE_CLASS.offline;

  return (
    <svg
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`w-full h-8 overflow-visible ${colorClass} transition-colors duration-150 motion-reduce:transition-none`}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={hasData ? undefined : '4 4'}
        opacity={hasData ? 1 : 0.45}
      />
      {hasData && lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill="currentColor" />
      )}
    </svg>
  );
});

export default Sparkline;

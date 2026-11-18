import { memo } from 'react';
import { Link } from '../hooks/useRouter';
import Sparkline from './Sparkline';
import { formatSafeRange } from '../lib/readingStatus';

const STATUS_META = {
  normal: {
    label: 'Normal',
    chip: 'bg-status-normal-bg text-status-normal-fg',
    accent: '',
  },
  warning: {
    label: 'Warning',
    chip: 'bg-status-warning-bg text-status-warning-fg',
    accent: 'border-l-2 border-l-status-warning-line',
  },
  critical: {
    label: 'Critical',
    chip: 'bg-status-critical-bg text-status-critical-fg',
    accent: 'border-l-2 border-l-status-critical-line',
  },
  offline: {
    label: 'Offline',
    chip: 'bg-status-offline-bg text-status-offline-fg',
    accent: '',
  },
  nodata: {
    label: 'No data',
    chip: 'bg-status-offline-bg text-status-offline-fg',
    accent: '',
  },
};

function buildReadableLabel(metric, statusLabel, formattedValue) {
  const valuePart =
    metric.value === null
      ? 'no reading'
      : metric.unit
        ? `${formattedValue} ${metric.unit}`
        : formattedValue;

  let rangePart = '';
  const u = metric.unit ? ` ${metric.unit}` : '';
  if (metric.safeMin != null && metric.safeMax != null) {
    rangePart = `, safe range ${metric.safeMin} to ${metric.safeMax}${u}`;
  } else if (metric.safeMin != null) {
    rangePart = `, safe minimum ${metric.safeMin}${u}`;
  } else if (metric.safeMax != null) {
    rangePart = `, safe maximum ${metric.safeMax}${u}`;
  }

  return `${metric.label}, ${valuePart}, ${statusLabel}${rangePart}`;
}

const ReadingCard = memo(function ReadingCard({
  metric,
  selected = false,
  onSelect,
  href,
  areaId,
}) {
  const meta = STATUS_META[metric.status] || STATUS_META.offline;
  const formattedValue = metric.value === null ? '–' : metric.value.toFixed(metric.decimals);
  const safeCaption = formatSafeRange(metric.safeMin, metric.safeMax, metric.unit);
  const accessibleSummary = buildReadableLabel(metric, meta.label, formattedValue);

  const isButton = !href && typeof onSelect === 'function';
  const isSelected = Boolean(isButton && selected);

  const surfaceClass = isSelected
    ? 'bg-primary-100 ring-1 ring-primary-300 border-primary-300'
    : 'bg-white/95 supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-md border-white/50';

  const interactiveClass =
    href || isButton
      ? 'cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
      : '';

  const rootClass = `rounded-2xl p-4 min-h-[148px] h-full flex flex-col text-left border shadow-sm transition-colors duration-150 motion-reduce:transition-none ${surfaceClass} ${meta.accent} ${interactiveClass}`;

  const body = (
    <>
      {!href && !isButton && <span className="sr-only">{accessibleSummary}</span>}

      <div className="flex items-start justify-between gap-2 w-full" aria-hidden={href || isButton ? 'true' : undefined}>
        <span className="text-sm font-medium text-slate-700 line-clamp-2 flex-1 min-w-0 leading-snug">
          {metric.label}
        </span>
        <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium shrink-0 transition-colors duration-150 motion-reduce:transition-none ${meta.chip}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
          <span>{meta.label}</span>
        </span>
      </div>

      <div className="mt-2 flex items-baseline w-full" aria-hidden={href || isButton ? 'true' : undefined}>
        <span className="text-[28px] leading-8 font-semibold tabular-nums text-ink">
          {formattedValue}
        </span>
        {metric.value !== null && metric.unit && (
          <span className="text-sm text-slate-600 ml-1">{metric.unit}</span>
        )}
      </div>

      <div className="mt-auto pt-2 w-full">
        <Sparkline values={metric.history} status={metric.status} />
      </div>

      {safeCaption && (
        <div className="mt-1.5 text-xs text-slate-600 truncate w-full" aria-hidden={href || isButton ? 'true' : undefined}>
          {safeCaption}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link to={href} aria-label={accessibleSummary} className={rootClass}>
        {body}
      </Link>
    );
  }

  if (isButton) {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={accessibleSummary}
        onClick={() => onSelect(areaId, metric.key)}
        className={rootClass}
      >
        {body}
      </button>
    );
  }

  return <div className={rootClass}>{body}</div>;
});

export default ReadingCard;

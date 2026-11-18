import { Link } from '../hooks/useRouter';
import ReadingCard from './ReadingCard';

const GRID_CLASS = {
  pond: 'grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3',
  garden: 'grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3',
};

export default function AreaSection({
  title,
  subtitle,
  detailsHref,
  metrics,
  gridKind = 'pond',
  areaId,
  selectedMetricKey = null,
  onSelectMetric,
}) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <section aria-label={subtitle ? `${title} — ${subtitle}` : title}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-ink m-0 flex items-baseline gap-1.5 flex-wrap">
          <span>{title}</span>
          {subtitle && (
            <>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="text-slate-500 font-normal">{subtitle}</span>
            </>
          )}
        </h2>
        {detailsHref && (
          <Link
            to={detailsHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-dark hover:text-brand hover:underline shrink-0 rounded px-1.5 py-0.5 bg-white/75 supports-[backdrop-filter]:backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <span>Details</span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>

      <div className={GRID_CLASS[gridKind] || GRID_CLASS.pond}>
        {metrics.map((metric) => (
          <ReadingCard
            key={metric.key}
            metric={metric}
            areaId={areaId}
            selected={selectedMetricKey === metric.key}
            onSelect={onSelectMetric}
          />
        ))}
      </div>
    </section>
  );
}

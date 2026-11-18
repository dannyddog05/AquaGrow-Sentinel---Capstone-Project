import { formatEquipmentState } from '../lib/equipment';

const DOT_CLASS = {
  running: 'bg-status-normal-line',
  off: 'bg-slate-300',
  offline: 'bg-status-offline-line',
  fault: 'bg-status-critical-line',
};

const STATE_TEXT_CLASS = {
  running: 'text-status-normal-fg font-medium',
  off: 'text-slate-600',
  offline: 'text-status-offline-fg',
  fault: 'text-status-critical-fg font-medium',
};

export default function EquipmentPanel({
  items = [],
  loading = false,
  error = null,
  onRetry,
}) {
  const scrollable = items.length > 6;

  return (
    <section
      aria-label="Equipment"
      className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm h-full flex flex-col min-w-0"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-semibold font-display text-ink m-0">Equipment</h2>
      </div>

      {loading ? (
        <ul className="m-0 p-0 list-none flex-1" aria-busy="true" aria-label="Loading equipment">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[44px] flex items-center justify-between gap-3 border-b border-slate-100 last:border-b-0">
              <div className="flex items-center gap-2.5 flex-1">
                <div className="w-2 h-2 rounded-full bg-slate-200 shrink-0" />
                <div className="h-3.5 w-1/2 rounded bg-slate-200 motion-safe:animate-pulse" />
              </div>
              <div className="h-3 w-20 rounded bg-slate-100 motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex-1 flex flex-col items-start justify-center gap-2 py-4">
          <p className="text-sm text-slate-700 m-0">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-ink text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-slate-500 m-0">No equipment registered.</p>
        </div>
      ) : (
        <div
          tabIndex={scrollable ? 0 : undefined}
          aria-label={scrollable ? 'Equipment list' : undefined}
          className={
            scrollable
              ? 'max-h-[280px] overflow-y-auto pr-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2'
              : 'flex-1'
          }
        >
          <ul className="m-0 p-0 list-none">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    aria-hidden="true"
                    className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[item.state] || DOT_CLASS.offline}`}
                  />
                  <span className="text-sm font-medium text-ink truncate" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <span className={`text-xs shrink-0 whitespace-nowrap ${STATE_TEXT_CLASS[item.state] || 'text-slate-600'}`}>
                  {formatEquipmentState(item.state, item.mode)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

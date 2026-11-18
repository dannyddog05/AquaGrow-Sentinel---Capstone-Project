import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../hooks/useRouter';
import { ago } from '../data/db';

const SEV_RANK = { critical: 0, warning: 1, offline: 2 };
const MAX_VISIBLE = 5;

function AlertIcon({ sev }) {
  if (sev === 'critical') {
    return (
      <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center shrink-0 text-status-critical-line">
        <span className="sr-only">Critical</span>
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    );
  }
  if (sev === 'warning') {
    return (
      <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center shrink-0 text-status-warning-line">
        <span className="sr-only">Warning</span>
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-white/10 grid place-items-center shrink-0 text-white/65">
      <span className="sr-only">Offline</span>
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    </div>
  );
}

export default function OpenAlertsPanel({
  alerts = [],
  areas = [],
  canAct = false,
  allReadingsSafe = false,
  onAcknowledge,
  onResolve,
  loading = false,
  error = null,
  onRetry,
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [announcement, setAnnouncement] = useState('');

  const viewAllRef = useRef(null);
  const rowRefs = useRef(new Map());
  const pendingFocusIndexRef = useRef(null);

  const sortedOpen = useMemo(
    () =>
      alerts
        .filter((a) => a.status !== 'resolved')
        .sort((a, b) => (SEV_RANK[a.sev] ?? 3) - (SEV_RANK[b.sev] ?? 3) || b.t - a.t),
    [alerts]
  );

  const visible = useMemo(() => sortedOpen.slice(0, MAX_VISIBLE), [sortedOpen]);

  useEffect(() => {
    if (pendingFocusIndexRef.current === null) return;
    const idx = pendingFocusIndexRef.current;
    pendingFocusIndexRef.current = null;
    if (visible.length === 0) {
      viewAllRef.current?.focus();
      return;
    }
    const target = visible[Math.min(idx, visible.length - 1)];
    const el = target && rowRefs.current.get(target.id);
    const focusable = el?.querySelector('button:not(:disabled)');
    if (focusable) focusable.focus();
    else viewAllRef.current?.focus();
  }, [visible]);

  const titleFor = (r) => {
    const areaNames = (r.areaIds || [])
      .map((id) => areas.find((a) => a.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    return areaNames ? `${r.title} · ${areaNames}` : r.title;
  };

  const runAction = async (r, kind, rowIndex) => {
    const fn = kind === 'ack' ? onAcknowledge : onResolve;
    if (!fn) return;
    setRowErrors((prev) => {
      if (!prev[r.id]) return prev;
      const next = { ...prev };
      delete next[r.id];
      return next;
    });
    setPendingIds((prev) => new Set(prev).add(r.id));
    if (kind === 'resolve') pendingFocusIndexRef.current = rowIndex;

    try {
      await Promise.resolve(fn(r));
      setAnnouncement(kind === 'ack' ? 'Alert acknowledged' : 'Alert resolved');
    } catch (e) {
      if (kind === 'resolve') pendingFocusIndexRef.current = null;
      setRowErrors((prev) => ({
        ...prev,
        [r.id]: e?.message || `Could not ${kind === 'ack' ? 'acknowledge' : 'resolve'} alert.`,
      }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  };

  return (
    <section
      aria-label="Open alerts"
      className="rounded-2xl p-5 bg-surface-dark text-white shadow-sm h-full flex flex-col min-w-0"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold font-display text-white m-0">Open alerts</h2>
        <Link
          ref={viewAllRef}
          to="/alerts?tab=active"
          className="text-sm font-medium text-surface-dark-link hover:underline shrink-0 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-dark-link focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark"
        >
          View all ({sortedOpen.length})
        </Link>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {loading ? (
        <ul className="m-0 p-0 list-none flex-1" aria-busy="true" aria-label="Loading alerts">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[60px] flex items-center gap-3 border-b border-white/10 last:border-b-0">
              <div className="w-9 h-9 rounded-lg bg-white/10 shrink-0 motion-safe:animate-pulse" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-white/15 motion-safe:animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-white/10 motion-safe:animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex-1 flex flex-col items-start justify-center gap-2 py-4">
          <p className="text-sm text-white/85 m-0">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="h-9 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-dark-link focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark"
            >
              Retry
            </button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-1.5">
          <span className="w-10 h-10 rounded-full bg-white/10 grid place-items-center text-surface-dark-link" aria-hidden="true">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-white m-0">No open alerts</p>
          {allReadingsSafe && (
            <p className="text-xs text-white/75 m-0">All readings are within safe range.</p>
          )}
        </div>
      ) : (
        <ul className="m-0 p-0 list-none flex-1">
          {visible.map((r, index) => {
            const label = titleFor(r);
            const isPending = pendingIds.has(r.id);
            const rowErr = rowErrors[r.id];
            return (
              <li
                key={r.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(r.id, el);
                  else rowRefs.current.delete(r.id);
                }}
                className="py-3 border-b border-white/10 last:border-b-0"
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <AlertIcon sev={r.sev} />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate" title={label}>
                      {label}
                    </div>
                    <div className="text-xs text-white/75 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <time dateTime={new Date(r.t).toISOString()}>{ago(r.t)}</time>
                      {r.status === 'ack' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Acknowledged</span>
                        </>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {r.status === 'open' && (
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={`Acknowledge: ${label}`}
                          onClick={() => runAction(r, 'ack', index)}
                          className="h-11 sm:h-8 px-3.5 sm:px-3 rounded-full bg-white text-ink text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-dark-link focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending}
                        aria-label={`Resolve: ${label}`}
                        onClick={() => runAction(r, 'resolve', index)}
                        className="h-11 sm:h-8 px-2.5 sm:px-2 rounded-lg bg-transparent text-white/75 hover:text-white hover:bg-white/10 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-dark-link focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark"
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>

                {rowErr && (
                  <p role="alert" className="mt-1.5 ml-12 text-xs text-status-critical-bg m-0">
                    {rowErr}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

import { useEffect } from 'react';
import { useSearchParams } from '../hooks/useRouter';

/**
 * Reusable URL-driven Tabs component.
 * Tabs: [{ id: string, label: string, badge?: number, hidden?: boolean, content?: ReactNode }]
 */
export default function Tabs({ tabs, param = 'tab', value, onChange, ariaLabel = 'Section tabs' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const controlled = value !== undefined && typeof onChange === 'function';
  const raw = controlled ? value : searchParams.get(param);
  const active = visible.find((t) => t.id === raw) || visible[0];

  useEffect(() => {
    if (controlled || !active) return;
    if (raw !== active.id) {
      const next = new URLSearchParams(searchParams);
      next.set(param, active.id);
      setSearchParams(next, { replace: true });
    }
  }, [controlled, active, raw, param, searchParams, setSearchParams]);

  if (!visible.length) return null;

  const select = (id) => {
    if (controlled) return onChange(id);
    const next = new URLSearchParams(searchParams);
    next.set(param, id);
    setSearchParams(next);
  };

  return (
    <>
      <div className="bg-white/85 backdrop-blur-md border-b border-line px-3 sm:px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[1500px] 3xl:max-w-[1700px]" role="tablist" aria-label={ariaLabel}>
          {visible.map((t) => {
            const isOn = active && t.id === active.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={isOn}
                aria-controls={`panel-${t.id}`}
                onClick={() => select(t.id)}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-0 border-b-[2.5px] bg-transparent font-semibold text-[14px] sm:text-[15px] whitespace-nowrap transition-colors ${isOn
                  ? 'text-brand-dark border-b-brand'
                  : 'text-mut border-b-transparent hover:text-ink'
                  }`}
              >
                <span>{t.label}</span>
                {t.badge > 0 && (
                  <em className="not-italic bg-crit text-white text-[11px] font-bold rounded-full px-[7px] leading-[18px]">
                    {t.badge}
                  </em>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {active && active.content !== undefined && (
        <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`}>
          {active.content}
        </div>
      )}
    </>
  );
}

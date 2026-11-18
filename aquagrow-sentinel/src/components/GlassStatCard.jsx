/**
 * Frosted stat preview card for the Login hero panel.
 * Supports `variant="green"` (solid lush green card) and `variant="glass"` (frosted translucent glass card).
 */
export default function GlassStatCard({ variant = 'glass', icon, title, subtitle, stats }) {
  const surface =
    variant === 'green'
      ? 'bg-gradient-to-br from-[#34b34a]/92 via-[#2e9e44]/92 to-[#1f7a34]/95 border border-white/25 shadow-[0_14px_34px_rgba(18,72,34,0.28)]'
      : 'bg-white/20 backdrop-blur-md border border-white/30 shadow-[0_14px_34px_rgba(18,48,42,0.18)]';

  return (
    <div className={`rounded-2xl p-4 text-white text-left ${surface}`}>
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="w-9 h-9 rounded-lg bg-white/15 grid place-items-center flex-none"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold text-[15px] leading-tight truncate">{title}</div>
          <div className="text-[11.5px] text-white/80 leading-tight mt-0.5 truncate">{subtitle}</div>
        </div>
      </div>
      <div className="border-t border-white/20 my-3" />
      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <div className="text-[10.5px] text-white/75 leading-tight truncate">{label}</div>
            <div className="font-display font-bold text-[13.5px] leading-snug mt-0.5 whitespace-nowrap">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

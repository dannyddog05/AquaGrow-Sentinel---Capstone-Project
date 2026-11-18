import { Link } from '../hooks/useRouter';

/**
 * Rounded pill CTA button/link matching the Home mockup.
 * Variants: 'solid-white' | 'outline'
 */
export default function PillButton({
  variant = 'solid-white',
  to,
  href,
  onClick,
  children,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-between h-12 rounded-full font-semibold text-[15px] whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2';

  const styles =
    variant === 'outline'
      ? 'px-6 gap-3 border border-ink/35 text-ink bg-white/80 hover:bg-ink/5 lg:border-white/75 lg:text-white lg:bg-black/20 lg:backdrop-blur-[2px] lg:hover:bg-white/15 lg:hover:border-white'
      : 'pl-6 pr-1.5 gap-5 bg-white text-black border border-line/80 lg:border-transparent shadow-[0_6px_20px_rgba(18,48,42,0.14)] hover:bg-[#f4f7f5] hover:shadow-[0_10px_26px_rgba(18,48,42,0.2)]';

  const content =
    variant === 'outline' ? (
      <>
        <span>{children}</span>
        <span aria-hidden="true" className="text-[14px] leading-none">↗</span>
      </>
    ) : (
      <>
        <span>{children}</span>
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-full bg-black text-white grid place-items-center text-[15px] leading-none flex-none"
        >
          ↗
        </span>
      </>
    );

  const cls = `${base} ${styles} ${className}`;

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} {...rest}>
      {content}
    </button>
  );
}


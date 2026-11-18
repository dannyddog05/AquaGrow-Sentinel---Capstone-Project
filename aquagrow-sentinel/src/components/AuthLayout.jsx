import { Link } from '../hooks/useRouter';
import logo from '../assets/logo.png';
import authBg from '../assets/sa.png';

/**
 * Reusable split-screen layout with decorative aerial photo fading into white on the left,
 * top-left AquaGrow Sentinel brand header, and responsive mobile centering.
 */
export default function AuthLayout({ children, right, rightBottom, footer }) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-white overflow-hidden">
      {/* Decorative aerial background fading to white on the left; faint below lg */}
      <img
        src={authBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover object-right opacity-20 lg:opacity-100"
      />
      {/* Left-side white legibility fade & subtle bottom-right scrim over photo on lg+ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-white/75 lg:bg-transparent lg:bg-gradient-to-r lg:from-white lg:via-white/85 lg:via-[28%] lg:to-transparent"
      />
      {(right || rightBottom) && (
        <div
          aria-hidden="true"
          className="pointer-events-none hidden lg:block absolute inset-0 bg-[radial-gradient(640px_240px_at_76%_96%,rgba(10,24,18,0.45),transparent)]"
        />
      )}

      {/* Top-left brand logo */}
      <header className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 pt-6 sm:pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <img src={logo} alt="AquaGrow Sentinel" className="w-10 h-10 flex-none" />
          <div>
            <span className="block font-display font-bold text-[18px] leading-[1.1] text-brand-dark">AquaGrow</span>
            <span className="block text-[11px] font-bold tracking-wide text-accent">Sentinel</span>
          </div>
        </Link>
      </header>

      {/* Split main content */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 py-10 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
        <div className="lg:col-span-5 flex flex-col items-center text-center lg:items-start lg:text-left">
          {children}
        </div>
        {right && (
          <div className="hidden lg:flex lg:col-span-7 flex-col items-end justify-end self-center pt-10 xl:pt-14 pl-6">
            {right}
          </div>
        )}
        {rightBottom && (
          <div className="lg:col-span-7 flex flex-col items-center lg:self-end lg:pb-6 lg:pl-8">
            {rightBottom}
          </div>
        )}
      </main>

      {/* Bottom-left footer */}
      {footer && (
        <footer className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14 pb-6 pt-2 text-center lg:text-left">
          {footer}
        </footer>
      )}
    </div>
  );
}


import AuthLayout from './AuthLayout';
import PillButton from './PillButton';

export default function HomePage() {
  return (
    <AuthLayout
      rightBottom={
        <div className="w-full max-w-[560px] flex flex-col items-center">
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <PillButton variant="solid-white" to="/login">
              Sign In
            </PillButton>
          </div>
          <p className="mt-4 text-center text-[13px] sm:text-[14px] text-mut lg:text-white/95 lg:[text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
            Real-time alerts for water, soil, and irrigation. Built for small-scale growers.
          </p>
        </div>
      }
      footer={
        <p className="text-[12px] text-mut m-0">
          © 2026 AquaGrow Sentinel · Sustainable IoT monitoring for small-scale growers
        </p>
      }
    >
      <span className="inline-flex items-center px-3.5 py-1 rounded-full text-[12px] font-bold bg-brand-pale text-brand-dark border border-brand/20 mb-5">
        Smart IoT Monitoring
      </span>
      <h1 className="font-display font-bold text-[34px] sm:text-[44px] lg:text-[48px] leading-[1.1] tracking-[-0.02em] text-ink max-w-[16ch] mb-4">
        Smarter care for your ponds and gardens.
      </h1>
      <p className="text-[16px] sm:text-[17px] leading-[1.6] text-mut max-w-[44ch] m-0">
        AquaGrow Sentinel tracks water quality and soil moisture in real time, so you can act before small problems become big losses.
      </p>
    </AuthLayout>
  );
}


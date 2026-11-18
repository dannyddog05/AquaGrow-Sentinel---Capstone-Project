import { useMemo, useState } from 'react';
import { Link } from '../hooks/useRouter';
import { USERS } from '../data/constants';
import { hashPw } from '../data/db';
import AuthLayout from './AuthLayout';
import AuthInput from './AuthInput';
import PasswordInput from './PasswordInput';
import GlassStatCard from './GlassStatCard';
import { SPIN } from './ui';

const FishIcon = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z" />
    <path d="M18 12v.5" />
    <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
    <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33" />
  </svg>
);

const PlantIcon = () => (
  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22v-9" />
    <path d="M12 13C12 8.5 8.5 5 3 5c0 5.5 3.5 9 9 9" />
    <path d="M12 13c0-4.5 3.5-8 9-8 0 5.5-3.5 9-9 9" />
    <path d="M7 22h10" />
  </svg>
);

export default function Login({ users, org, onLogin }) {
  const [em, setEm] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [bz, setBz] = useState(false);
  const [fails, setFails] = useState(0);
  const [lock, setLock] = useState(0);
  const [remember, setRemember] = useState(true);

  // demo shortcuts only appear while an account still has its original demo password
  const demo = useMemo(
    () => USERS.filter((def) => {
      const u = users.find((x) => x.id === def.id);
      return u && u.active !== false && hashPw(def.pw, u.salt) === u.pw;
    }),
    [users]
  );

  const go = (e) => {
    e.preventDefault();
    if (Date.now() < lock) {
      setFieldErr({});
      return setErr(`Too many attempts. Try again in ${Math.ceil((lock - Date.now()) / 1000)} seconds.`);
    }
    const fe = {};
    if (!em.trim()) fe.em = 'Email address is required.';
    else if (!/^\S+@\S+\.\S+$/.test(em)) fe.em = 'Enter a valid email address.';
    if (!pw) fe.pw = 'Password is required.';
    else if (pw.length < 6) fe.pw = 'Password must be at least 6 characters.';
    if (Object.keys(fe).length) {
      setErr('');
      return setFieldErr(fe);
    }

    setFieldErr({});
    setErr('');
    setBz(true);
    setTimeout(() => {
      const u = users.find((x) => x.email.toLowerCase() === em.trim().toLowerCase());
      const good = u && hashPw(pw, u.salt) === u.pw;
      setBz(false);
      if (good && u.active === false) return setErr('This account is disabled. Ask an owner to enable it.');
      if (good) { setFails(0); return onLogin(u); }
      const f = fails + 1;
      setFails(f);
      if (f >= 5) {
        setLock(Date.now() + 30000);
        setFails(0);
        setErr('Too many attempts. Try again in 30 seconds.');
      } else {
        setErr('Email or password is incorrect.');
      }
    }, 600);
  };

  return (
    <AuthLayout
      right={
        <div className="w-full max-w-[590px] flex flex-col items-end">
          <div className="text-right">
            <h2 className="font-display font-bold text-[52px] xl:text-[62px] leading-[1.03] tracking-[-0.025em] m-0">
              <span className="block">
                <span className="bg-gradient-to-r from-[#238c3c] via-[#4ea832] to-[#7ab82d] bg-clip-text text-transparent">
                  Grow
                </span>{' '}
                <span className="text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
                  Smarter
                </span>
              </span>
              <span className="block bg-gradient-to-r from-[#22a83c] via-[#5ec22c] to-[#1a5226] bg-clip-text text-transparent">
                Monitor Better.
              </span>
            </h2>
            <p className="mt-3 text-white font-semibold text-[15px] leading-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]">
              AquaGrow Sentinel
            </p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
              SMART MONITORING SYSTEM.
            </p>
            <p className="mt-1.5 text-[14px] text-white/85 max-w-[36ch] ml-auto leading-snug drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
              Monitor your aquatic environment and garden with confidence.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mt-7 w-full">
            <GlassStatCard
              variant="green"
              icon={<FishIcon />}
              title="Smart Aquaculture"
              subtitle="Water Quality Monitoring"
              stats={[
                { label: 'pH', value: '7.2' },
                { label: 'Dissolved O₂', value: '6.8 mg/L' },
                { label: 'Water temp', value: '26.4°C' },
              ]}
            />
            <GlassStatCard
              variant="glass"
              icon={<PlantIcon />}
              title="Urban Gardening"
              subtitle="Smart Irrigation Monitoring"
              stats={[
                { label: 'Soil moisture', value: '64%' },
                { label: 'Humidity', value: '71%' },
                { label: 'Next cycle', value: '06:30' },
              ]}
            />
          </div>
        </div>
      }
      footer={
        <p className="text-[12px] text-mut m-0">
          © 2026 AquaGrow Sentinel · Sustainable IoT monitoring for small-scale growers
        </p>
      }
    >
      <div className="w-full max-w-[380px] text-left">
        <h1 className="font-display font-bold text-[30px] sm:text-[34px] leading-[1.15] tracking-[-0.02em] text-ink m-0">
          Welcome Back!
        </h1>
        <p className="text-mut text-[14px] mt-1.5 mb-6">
          Sign in to access your AquaGrow monitoring system.
        </p>

        <form onSubmit={go} noValidate>
          <AuthInput
            id="login-email"
            label="Email Address"
            type="email"
            value={em}
            onChange={(e) => {
              setEm(e.target.value);
              if (fieldErr.em) setFieldErr((p) => ({ ...p, em: '' }));
              if (err) setErr('');
            }}
            placeholder="Enter your email address"
            autoComplete="username"
            error={fieldErr.em}
            disabled={bz}
          />
          <PasswordInput
            id="login-password"
            label="Password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (fieldErr.pw) setFieldErr((p) => ({ ...p, pw: '' }));
              if (err) setErr('');
            }}
            placeholder="Enter your password"
            autoComplete="current-password"
            error={fieldErr.pw}
            disabled={bz}
          />

          <div className="flex items-center justify-between gap-3 mt-1 mb-5">
            <label className="inline-flex items-center gap-2 text-[13px] font-medium text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded accent-brand cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-[13px] font-semibold text-brand-dark hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              Forgot Password?
            </Link>
          </div>

          {err && (
            <p role="alert" className="mb-4 flex items-center gap-1.5 text-[12.5px] font-medium text-[#d64545]">
              <span
                aria-hidden="true"
                className="inline-grid place-items-center w-3.5 h-3.5 rounded-full border border-[#d64545] text-[10px] font-bold leading-none flex-none"
              >
                !
              </span>
              <span>{err}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={bz}
            className="w-full h-12 rounded-lg bg-[#2e854e] hover:bg-brand-dark text-white font-semibold text-[15px] inline-flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {bz && <span className={SPIN} />}
            {bz ? 'Signing In…' : 'Sign In'}
          </button>
        </form>

        <div className="border-t border-line my-5" />

        <p className="text-center text-[13px] text-mut m-0">
          Don&apos;t have an account?{' '}
          <span className="font-semibold text-ink">Contact your administrator.</span>
        </p>

        {demo.length > 0 && (
          <div className="mt-5 pt-4 border-t border-line/70">
            <div className="text-mut text-[11.5px] text-center mb-2">Demo accounts (tap to fill):</div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {demo.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => {
                    setEm(u.email);
                    setPw(u.pw);
                    setErr('');
                    setFieldErr({});
                  }}
                  className="px-2.5 py-1 text-[12px] font-semibold rounded-md border border-line bg-white text-ink hover:bg-brand-soft transition-colors"
                >
                  {u.name.split(' ')[0]} ({u.role})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

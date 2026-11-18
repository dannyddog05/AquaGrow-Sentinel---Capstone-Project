import { useState } from 'react';
import { Link } from '../hooks/useRouter';
import AuthLayout from './AuthLayout';
import AuthInput from './AuthInput';
import { SPIN } from './ui';

export default function ForgotPasswordPage() {
  const [em, setEm] = useState('');
  const [err, setErr] = useState('');
  const [bz, setBz] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = em.trim();
    if (!trimmed) return setErr('Email address is required.');
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) return setErr('Enter a valid email address.');
    setErr('');
    setBz(true);
    setTimeout(() => {
      setBz(false);
      setSentTo(trimmed);
    }, 500);
  };

  return (
    <AuthLayout
      footer={
        <p className="text-[12px] text-mut m-0">
          © 2026 AquaGrow Sentinel · Sustainable IoT monitoring for small-scale growers
        </p>
      }
    >
      <div className="w-full max-w-[380px] text-left">
        <h1 className="font-display font-bold text-[30px] sm:text-[34px] leading-[1.15] tracking-[-0.02em] text-ink m-0">
          Reset Your Password
        </h1>
        <p className="text-mut text-[14px] leading-relaxed mt-2 mb-6">
          Enter your registered email address to receive password reset instructions.
        </p>

        <form onSubmit={submit} noValidate>
          <AuthInput
            id="reset-email"
            label="Email Address"
            type="email"
            value={em}
            onChange={(e) => {
              setEm(e.target.value);
              if (err) setErr('');
              if (sentTo) setSentTo('');
            }}
            placeholder="Enter your email address"
            autoComplete="email"
            error={err}
            disabled={bz}
          />

          {sentTo && (
            <p
              role="status"
              className="mb-4 text-[13px] text-brand-dark bg-brand-pale/70 border border-brand/25 rounded-lg px-3.5 py-2.5"
            >
              If an account exists for <b>{sentTo}</b>, password reset instructions have been sent.
            </p>
          )}

          <button
            type="submit"
            disabled={bz}
            className="w-full h-12 rounded-lg bg-[#2e854e] hover:bg-brand-dark text-white font-semibold text-[15px] inline-flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {bz && <span className={SPIN} />}
            {bz ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-5">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-dark hover:text-brand hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <svg
              className="w-4 h-4 flex-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}


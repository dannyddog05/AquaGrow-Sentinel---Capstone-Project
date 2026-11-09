import { useMemo, useState } from 'react';
import { USERS } from '../data/constants';
import { hashPw } from '../data/db';
import logo from '../assets/logo.png';

export default function Login({ users, org, onLogin }) {
  const [em, setEm] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [bz, setBz] = useState(false), [fails, setFails] = useState(0), [lock, setLock] = useState(0);
  // demo shortcuts only appear while an account still has its original demo password
  const demo = useMemo(() => USERS.filter((def) => { const u = users.find((x) => x.id === def.id); return u && u.active !== false && hashPw(def.pw, u.salt) === u.pw; }), [users]);
  const go = (e) => {
    e.preventDefault();
    if (Date.now() < lock) return setErr(`Too many attempts. Try again in ${Math.ceil((lock - Date.now()) / 1000)} seconds.`);
    if (!/^\S+@\S+\.\S+$/.test(em)) return setErr('Enter a valid email address.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    setErr(''); setBz(true);
    setTimeout(() => {
      const u = users.find((x) => x.email.toLowerCase() === em.trim().toLowerCase()), good = u && hashPw(pw, u.salt) === u.pw;
      setBz(false);
      if (good && u.active === false) return setErr('This account is disabled. Ask an owner to enable it.');
      if (good) { setFails(0); return onLogin(u); }
      const f = fails + 1; setFails(f);
      if (f >= 5) { setLock(Date.now() + 30000); setFails(0); setErr('Too many attempts. Try again in 30 seconds.'); } else setErr('Email or password is incorrect.');
    }, 600);
  };
  return (
    <div className="login"><div className="card lg">
      <img src={logo} alt="AquaGrow Sentinel logo" />
      <h1 style={{ textAlign: 'center', fontSize: 24, color: 'var(--gd)' }}>AquaGrow Sentinel</h1>
      <p className="mut" style={{ textAlign: 'center', margin: '4px 0 18px' }}>Sign in to monitor {org || 'your farm'}</p>
      <form onSubmit={go} noValidate>
        <label className="fld">Email<input type="email" value={em} onChange={(e) => setEm(e.target.value)} autoComplete="username" /></label>
        <label className="fld">Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        {err && <div className="err" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
        <button className="btn p" style={{ width: '100%', padding: 11 }} disabled={bz}>{bz && <span className="spin" />}{bz ? 'Signing in' : 'Sign in'}</button>
      </form>
      {demo.length > 0 && <>
        <div className="mut" style={{ fontSize: 12, marginTop: 16 }}>Demo accounts (tap to fill):</div>
        <div className="demo">{demo.map((u) => <button type="button" className="btn" key={u.id} onClick={() => { setEm(u.email); setPw(u.pw); setErr(''); }}>{u.name.split(' ')[0]} ({u.role})</button>)}</div>
      </>}
    </div></div>
  );
}

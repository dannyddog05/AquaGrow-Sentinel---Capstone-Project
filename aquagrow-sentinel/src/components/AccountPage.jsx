import { useRef, useState } from 'react';
import { PERMS } from '../data/constants';
import { can, hashPw } from '../data/db';
import { Avatar, Field, useToast } from './ui';
import { PrefsCard } from './NotificationsPage';
import logo from '../assets/logo.png';

export const pwProblem = (p) => (p.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Include at least one letter and one number.' : '');

function resize(file, size = 128) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = size; const s = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

export function PasswordForm({ user, update, onDone }) {
  const [cur, setCur] = useState(''), [nw, setNw] = useState(''), [cf, setCf] = useState(''), [err, setErr] = useState({});
  const submit = () => {
    const x = {};
    if (hashPw(cur, user.salt) !== user.pw) x.cur = 'The current password is incorrect.';
    const pp = pwProblem(nw); if (pp) x.nw = pp; else if (nw === cur) x.nw = 'Choose a different password.';
    if (nw !== cf) x.cf = 'The passwords do not match.';
    setErr(x);
    if (Object.keys(x).length) return;
    update((n) => { const u = n.users.find((q) => q.id === user.id); u.pw = hashPw(nw, u.salt); u.mustChange = false; }, 'Changed own password', user.name);
    setCur(''); setNw(''); setCf(''); onDone && onDone();
  };
  return (
    <>
      <Field label="Current password" err={err.cur}><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
      <Field label="New password" err={err.nw}><input type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" /><small className="mut">At least 8 characters with a letter and a number.</small></Field>
      <Field label="Confirm new password" err={err.cf}><input type="password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" /></Field>
      <button className="btn p" onClick={submit}>Change password</button>
    </>
  );
}

export function ForcePassword({ user, update, onSignOut }) {
  return (
    <div className="login"><div className="card lg">
      <img src={logo} alt="" />
      <h1 style={{ textAlign: 'center', fontSize: 22 }}>Choose a new password</h1>
      <p className="mut" style={{ textAlign: 'center' }}>An owner set your temporary password. Pick your own to continue.</p>
      <PasswordForm user={user} update={update} />
      <button className="btn" style={{ marginTop: 10 }} onClick={onSignOut}>Sign out</button>
    </div></div>
  );
}

function Profile({ d, update, user, say }) {
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || '' }), [err, setErr] = useState({}), file = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const x = {};
    if (!f.name.trim()) x.name = 'Enter your full name.'; else if (f.name.length > 60) x.name = 'Keep the name under 60 characters.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) x.email = 'Enter a valid email address.';
    else if (d.users.some((u) => u.id !== user.id && u.email.toLowerCase() === f.email.trim().toLowerCase())) x.email = 'Another account already uses this email.';
    if (f.phone && !/^[+0-9 ()-]{7,20}$/.test(f.phone.trim())) x.phone = 'Use digits, spaces, + ( ) or - (7 to 20 characters).';
    setErr(x);
    if (Object.keys(x).length) return;
    update((n) => Object.assign(n.users.find((q) => q.id === user.id), { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() }), 'Updated own profile', f.name.trim());
    say('Profile saved.');
  };
  const pick = async (e) => {
    const fl = e.target.files[0]; e.target.value = '';
    if (!fl) return;
    if (!fl.type.startsWith('image/')) return say('Choose an image file (JPG or PNG).');
    if (fl.size > 3 * 1024 * 1024) return say('Choose an image under 3 MB.');
    try { const data = await resize(fl); update((n) => { n.users.find((q) => q.id === user.id).photo = data; }, 'Changed profile picture', user.name); say('Profile picture updated.'); } catch (er) { say(er.message); }
  };
  return (
    <div className="card">
      <h2>Profile</h2>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Avatar u={user} size={72} />
        <div className="acts">
          <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
          <button className="btn sm" onClick={() => file.current.click()}>{user.photo ? 'Change picture' : 'Upload picture'}</button>
          {user.photo && <button className="btn sm d" onClick={() => update((n) => { n.users.find((q) => q.id === user.id).photo = null; }, 'Removed profile picture', user.name)}>Remove</button>}
        </div>
      </div>
      <div className="fg">
        <Field label="Full name" err={err.name}><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Contact number" err={err.phone}><input value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="Email address" err={err.email} cls="full"><input type="email" value={f.email} onChange={set('email')} /></Field>
      </div>
      <button className="btn p" onClick={save}>Save profile</button>
    </div>
  );
}

export default function AccountPage({ d, update, user }) {
  const [toast, say] = useToast();
  const farms = user.role === 'Owner' ? 'All farms' : (user.farms || []).map((id) => d.farms.find((f) => f.id === id)?.name).filter(Boolean).join(', ') || 'None assigned';
  return (
    <div className="pg">
      <div className="grid c2" style={{ alignItems: 'start' }}>
        <div className="grid">
          <Profile key={user.id} d={d} update={update} user={user} say={say} />
          <div className="card"><h2>Change password</h2><PasswordForm user={user} update={update} onDone={() => say('Password changed.')} /></div>
        </div>
        <div className="grid">
          <div className="card">
            <h2>Your access</h2>
            <dl className="kv"><dt>Role</dt><dd><span className="role">{user.role}</span></dd><dt>Farms</dt><dd>{farms}</dd><dt>Last sign-in</dt><dd>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}</dd></dl>
            {PERMS.map(([k, l]) => <div className="tg" key={k}><span>{l}</span><b style={{ color: can(user, k) ? 'var(--gd)' : 'var(--mut)' }}>{can(user, k) ? 'Allowed' : 'Not allowed'}</b></div>)}
          </div>
          {user.role !== 'Viewer' && <PrefsCard d={d} update={update} user={user} />}
        </div>
      </div>
      {toast}
    </div>
  );
}

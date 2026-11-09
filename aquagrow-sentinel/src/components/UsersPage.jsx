import { useState } from 'react';
import { PERMS, ROLE_INFO } from '../data/constants';
import { addLog, genPw, hashPw, now } from '../data/db';
import { Avatar, Confirm, DataTable, Field, Modal, useToast } from './ui';
import { pwProblem } from './AccountPage';

const fmt = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never');

function UserForm({ d, u, self, onSave, onClose }) {
  const [f, setF] = useState({ name: u?.name || '', email: u?.email || '', phone: u?.phone || '', role: u?.role || 'Staff', farms: u?.farms || [], active: u ? u.active !== false : true, password: u ? '' : genPw(), perms: Object.fromEntries(PERMS.map(([k]) => [k, !(u?.perms && u.perms[k] === false)])) });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tog = (k, v) => setF({ ...f, [k]: v });
  const submit = () => {
    const x = {}, email = f.email.trim();
    if (!f.name.trim()) x.name = 'Enter a name.';
    if (!/^\S+@\S+\.\S+$/.test(email)) x.email = 'Enter a valid email address.';
    else if (d.users.some((q) => q.id !== u?.id && q.email.toLowerCase() === email.toLowerCase())) x.email = 'Another account already uses this email.';
    if (f.phone && !/^[+0-9 ()-]{7,20}$/.test(f.phone.trim())) x.phone = 'Use digits, spaces, + ( ) or -.';
    if (f.role !== 'Owner' && f.farms.length === 0) x.farms = 'Assign at least one farm, otherwise this user sees nothing.';
    if (!u && pwProblem(f.password)) x.password = pwProblem(f.password);
    setErr(x);
    if (Object.keys(x).length) return;
    onSave({ id: u?.id, name: f.name.trim(), email, phone: f.phone.trim(), role: f.role, farms: f.role === 'Owner' ? [] : f.farms, active: f.active, password: f.password,
      perms: f.role === 'Staff' ? Object.fromEntries(PERMS.filter(([k]) => !f.perms[k]).map(([k]) => [k, false])) : {} });
  };
  return (
    <Modal title={u ? `Edit ${u.name}` : 'Add user'} onClose={onClose} foot={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn p" onClick={submit}>{u ? 'Save changes' : 'Add user'}</button></>}>
      <div className="fg">
        <Field label="Full name" err={err.name}><input autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label="Contact number" err={err.phone}><input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email address" err={err.email}><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Role"><select value={f.role} onChange={set('role')} disabled={self}>{['Owner', 'Staff', 'Viewer'].map((r) => <option key={r}>{r}</option>)}</select></Field>
        <div className="full mut" style={{ fontSize: 13, marginBottom: 10 }}>{ROLE_INFO[f.role]}</div>
        {!u && <Field label="Temporary password" err={err.password} cls="full"><span className="acts"><input style={{ flex: 1 }} value={f.password} onChange={set('password')} /><button type="button" className="btn sm" onClick={() => tog('password', genPw())}>Generate</button></span><small className="mut">The user must choose a new password at first sign-in.</small></Field>}
      </div>
      {f.role !== 'Owner' && (
        <div className={`fld${err.farms ? ' bad' : ''}`}>Assigned farms
          <div>{d.farms.map((fm) => <label key={fm.id} className="chk" style={{ display: 'inline-flex' }}><input type="checkbox" checked={f.farms.includes(fm.id)} onChange={() => tog('farms', f.farms.includes(fm.id) ? f.farms.filter((x) => x !== fm.id) : [...f.farms, fm.id])} />{fm.name}</label>)}</div>
          {err.farms && <span className="err">{err.farms}</span>}
        </div>
      )}
      {f.role === 'Staff' && <div className="fld">Permissions{PERMS.map(([k, l]) => <label className="tg" key={k}><span>{l}</span><input type="checkbox" checked={f.perms[k]} onChange={(e) => setF({ ...f, perms: { ...f.perms, [k]: e.target.checked } })} /></label>)}</div>}
      {u && !self && <label className="tg"><span>Account active<br /><small className="mut">Disabled accounts cannot sign in.</small></span><input type="checkbox" checked={f.active} onChange={(e) => tog('active', e.target.checked)} /></label>}
    </Modal>
  );
}

export default function UsersPage({ d, update, user }) {
  const [mod, setMod] = useState(null), [toast, say] = useToast(), close = () => setMod(null);
  const owners = d.users.filter((u) => u.role === 'Owner' && u.active !== false).length;
  const farmNames = (u) => (u.role === 'Owner' ? 'All farms' : (u.farms || []).map((id) => d.farms.find((f) => f.id === id)?.name).filter(Boolean).join(', ') || 'None');
  if (user.role !== 'Owner') return <div className="pg"><div className="card"><p className="mut">Only owners can manage users.</p></div></div>;

  const save = (x) => {
    const old = x.id ? d.users.find((u) => u.id === x.id) : null, notes = [];
    if (old) {
      if (old.role !== x.role) notes.push(`Changed role of "${x.name}": ${old.role} → ${x.role}`);
      if ((old.farms || []).slice().sort().join() !== x.farms.slice().sort().join()) notes.push(`Changed farm access of "${x.name}"`);
      if (JSON.stringify(old.perms || {}) !== JSON.stringify(x.perms)) notes.push(`Changed permissions of "${x.name}"`);
      if ((old.active !== false) !== x.active) notes.push(`${x.active ? 'Enabled' : 'Disabled'} account of "${x.name}"`);
      if (old.role === 'Owner' && x.role !== 'Owner' && owners <= 1) return say('At least one active owner is required.');
    }
    update((n) => {
      if (x.id) { Object.assign(n.users.find((q) => q.id === x.id), { name: x.name, email: x.email, phone: x.phone, role: x.role, farms: x.farms, perms: x.perms, active: x.active }); notes.forEach((t) => addLog(n, t, user.name)); }
      else { const id = 'u' + now(); n.users.push({ id, name: x.name, email: x.email, phone: x.phone, role: x.role, farms: x.farms, perms: x.perms, active: true, photo: null, salt: id, pw: hashPw(x.password, id), mustChange: true, created: now(), lastLogin: null }); }
    }, x.id ? `Edited user "${x.name}"` : `Added user "${x.name}" (${x.role})`, user.name);
    close();
    if (x.id) say('User updated.'); else setMod({ t: 'pw', name: x.name, email: x.email, password: x.password });
  };
  const reset = () => {
    const u = mod.u, pw = genPw();
    update((n) => { const q = n.users.find((z) => z.id === u.id); q.pw = hashPw(pw, q.salt); q.mustChange = true; }, `Reset password for "${u.name}"`, user.name);
    setMod({ t: 'pw', name: u.name, email: u.email, password: pw });
  };
  const remove = () => {
    const u = mod.u;
    update((n) => { n.users = n.users.filter((q) => q.id !== u.id); delete n.prefs[u.id]; n.alertRecs.forEach((a) => { if (a.assignee === u.id) a.assignee = null; }); n.notifs.forEach((x) => { x.to = x.to.filter((i) => i !== u.id); }); }, `Removed user "${u.name}"`, user.name);
    close(); say('User removed.');
  };

  return (
    <div className="pg">
      <div className="bar2"><div className="mut" style={{ fontSize: 14 }}>{d.users.length} users · {owners} active owner(s)</div><button className="btn p" onClick={() => setMod({ t: 'form' })}>+ Add user</button></div>
      <div className="grid c3">{Object.entries(ROLE_INFO).map(([r, t]) => <div className="card" key={r} style={{ padding: 14 }}><span className="role">{r}</span><p className="mut" style={{ margin: '8px 0 0', fontSize: 13 }}>{t}</p></div>)}</div>
      <div className="card"><h2>Users</h2>
        <div className="tw"><table className="tbl" style={{ minWidth: 820 }}>
          <thead><tr><th>User</th><th>Role</th><th>Farms</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>{d.users.map((u) => (
            <tr key={u.id}>
              <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Avatar u={u} size={34} /><div><b>{u.name}</b>{u.id === user.id && ' (you)'}<div className="mut" style={{ fontSize: 12 }}>{u.email}</div></div></div></td>
              <td><span className="role">{u.role}</span></td><td>{farmNames(u)}</td>
              <td><span className={`pill ${u.active === false ? 'offline' : 'normal'}`}>{u.active === false ? 'Disabled' : 'Active'}</span>{u.mustChange && <small className="mut"> · password change pending</small>}</td>
              <td>{fmt(u.lastLogin)}</td>
              <td><div className="acts" style={{ flexWrap: 'nowrap' }}>
                <button className="btn sm" onClick={() => setMod({ t: 'form', u })}>Edit</button>
                <button className="btn sm" onClick={() => setMod({ t: 'log', u })}>Activity</button>
                {u.id !== user.id && <button className="btn sm" onClick={() => setMod({ t: 'reset', u })}>Reset password</button>}
                {u.id !== user.id && <button className="btn sm d" onClick={() => setMod({ t: 'del', u })}>Remove</button>}
              </div></td>
            </tr>))}</tbody></table></div>
      </div>

      {mod?.t === 'form' && <UserForm d={d} u={mod.u} self={mod.u?.id === user.id} onSave={save} onClose={close} />}
      {mod?.t === 'pw' && <Modal title="Temporary password" onClose={close} foot={<button className="btn p" onClick={close}>Done</button>}>
        <p style={{ marginTop: 0 }}>Share this with <b>{mod.name}</b> ({mod.email}). It is shown only once, and they must replace it at their next sign-in.</p><p><span className="key" style={{ fontSize: 18 }}>{mod.password}</span></p></Modal>}
      {mod?.t === 'reset' && <Confirm title="Reset password?" ok="Reset password" onOk={reset} onClose={close}>A new temporary password will be created for <b>{mod.u.name}</b>. Their old password stops working immediately.</Confirm>}
      {mod?.t === 'del' && <Confirm title="Remove user?" ok="Remove" danger onOk={remove} onClose={close}><b>{mod.u.name}</b> will lose access. Alerts assigned to them become unassigned. Their past activity stays in the logs.</Confirm>}
      {mod?.t === 'log' && <Modal title={`Activity · ${mod.u.name}`} onClose={close} foot={<button className="btn" onClick={close}>Close</button>}>
        <DataTable columns={['Time', 'Activity']} rows={(d.logs || []).filter((l) => l.by === mod.u.name).slice(0, 100).map((l) => [fmt(l.t), l.msg])} empty="No recorded activity yet." step={15} /></Modal>}
      {toast}
    </div>
  );
}

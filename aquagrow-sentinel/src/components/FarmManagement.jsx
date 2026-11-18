import { useState } from 'react';
import { ACTS, BAR2, BTN, BTN_CRIT, BTN_P, BTN_SM, BTN_SM_D, CARD, CHK_LBL, ERR_TXT, Field, INNER_TABS, INP, KV_DL, Modal, PG, StatusDot, accent, innerTab, pill } from './ui';
import { SIDES, LBL } from './ThresholdEditor';
import { M, KIND } from '../data/constants';
import { addLog, can, recordTh, thDiff, areaStatus, devOf, metricsOf, thOf, level, ago, now } from '../data/db';

const capOf = (dv) => dv.cap || 2; // prototype rule: an ESP32 can serve up to 2 areas

function FarmForm({ farm, onSave, onClose }) {
  const [f, setF] = useState({ name: farm?.name || '', loc: farm?.loc || '', desc: farm?.desc || '' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    const x = {};
    if (!f.name.trim()) x.name = 'Farm name is required.'; else if (f.name.length > 60) x.name = 'Keep the name under 60 characters.';
    if (!f.loc.trim()) x.loc = 'Location is required.';
    setErr(x);
    if (!Object.keys(x).length) onSave({ id: farm?.id, name: f.name.trim(), loc: f.loc.trim(), desc: f.desc.trim() });
  };
  return (
    <Modal title={farm ? 'Edit farm' : 'Add farm'} onClose={onClose}
      foot={<><button className={BTN} onClick={onClose}>Cancel</button><button className={BTN_P} onClick={submit}>{farm ? 'Save changes' : 'Add farm'}</button></>}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Farm name" err={err.name}><input autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label="Location" err={err.loc}><input value={f.loc} onChange={set('loc')} /></Field>
        <Field label="Description" cls="full"><textarea rows="3" value={f.desc} onChange={set('desc')} /></Field>
      </div>
    </Modal>
  );
}

function AreaForm({ d, farmId, kind, area, onSave, onClose }) {
  const k = area ? area.kind : kind, opts = KIND[k], label = k === 'garden' ? 'Garden' : 'Pond';
  const base = thOf(d, area || {});
  const [f, setF] = useState({ name: area?.name || '', crop: area?.crop || '', desc: area?.desc || '', dev: area?.dev || '', metrics: area ? metricsOf(area) : opts });
  const [th, setTh] = useState(() => Object.fromEntries(opts.map((m) => [m, Object.fromEntries(SIDES[m].map((s) => [s, String(base[m]?.[s] ?? '')]))])));
  const [err, setErr] = useState({});
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });
  const toggle = (m) => setF({ ...f, metrics: f.metrics.includes(m) ? f.metrics.filter((x) => x !== m) : [...f.metrics, m] });
  const used = (dv) => d.areas.filter((x) => x.dev === dv.id && x.id !== area?.id).length;

  const submit = () => {
    const x = {}, nm = f.name.trim(), out = {};
    if (!nm) x.name = `${label} name is required.`;
    else if (d.areas.some((a) => a.farm === farmId && a.id !== area?.id && a.name.toLowerCase() === nm.toLowerCase())) x.name = 'This farm already has an area with that name.';
    if (!f.crop.trim()) x.crop = k === 'garden' ? 'Enter the crop type.' : 'Enter the aquatic species.';
    if (!f.metrics.length) x.metrics = 'Select at least one sensor.';
    const dv = d.devices.find((v) => v.id === f.dev);
    if (dv && used(dv) >= capOf(dv)) x.dev = `${dv.code} is already monitoring ${capOf(dv)} areas.`;
    opts.filter((m) => f.metrics.includes(m)).forEach((m) => {
      const v = {}; let bad = '';
      SIDES[m].forEach((s) => { const n = parseFloat(th[m][s]); if (isNaN(n)) bad = 'Fill in every threshold.'; v[s] = n; });
      if (!bad) {
        if (v.cl != null && v.wl != null && !(v.cl < v.wl)) bad = 'Critical must be lower than warning.';
        if (v.wh != null && v.ch != null && !(v.wh < v.ch)) bad = 'Warning must be lower than critical.';
        if (v.wl != null && v.wh != null && !(v.wl < v.wh)) bad = 'The lower range must be below the upper range.';
      }
      if (bad) x['t' + m] = bad;
      out[m] = v;
    });
    setErr(x);
    if (Object.keys(x).length) return;
    onSave({ id: area?.id, farm: farmId, kind: k, name: nm, crop: f.crop.trim(), desc: f.desc.trim(), dev: f.dev || null, metrics: opts.filter((m) => f.metrics.includes(m)), th: out });
  };

  return (
    <Modal title={`${area ? 'Edit' : 'Add'} ${label.toLowerCase()}`} onClose={onClose}
      foot={<><button className={BTN} onClick={onClose}>Cancel</button><button className={BTN_P} onClick={submit}>{area ? 'Save changes' : `Add ${label.toLowerCase()}`}</button></>}>
      <div className="grid grid-cols-2 gap-x-3">
        <Field label={`${label} name`} err={err.name}><input autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label={k === 'garden' ? 'Crop type' : 'Aquatic species'} err={err.crop}><input value={f.crop} onChange={set('crop')} placeholder={k === 'garden' ? 'e.g. Tomato' : 'e.g. Nile tilapia'} /></Field>
        <Field label="Description" cls="full"><textarea rows="2" value={f.desc} onChange={set('desc')} /></Field>
        <Field label="Assigned ESP32 device" err={err.dev} cls="full">
          <select value={f.dev} onChange={set('dev')}>
            <option value="">Not assigned</option>
            {d.devices.map((dv) => {
              const u = used(dv), full = u >= capOf(dv);
              return <option key={dv.id} value={dv.id} disabled={full}>{dv.code} · {dv.status} · {u}/{capOf(dv)} areas{full ? ' (full)' : ''}</option>;
            })}
          </select>
          <small className="text-mut font-normal">One ESP32 can monitor several areas when it has enough sensor pins. The limit here is a prototype rule.</small>
        </Field>
      </div>
      <div className="grid gap-1 mb-3 font-semibold text-[13px]">Assigned sensors
        <div>
          {opts.map((m) => (
            <label key={m} className={CHK_LBL}>
              <input type="checkbox" checked={f.metrics.includes(m)} disabled={opts.length === 1} onChange={() => toggle(m)} />
              {M[m].n}
            </label>
          ))}
        </div>
        {err.metrics && <span className={ERR_TXT}>{err.metrics}</span>}
      </div>
      <div className="font-semibold text-[13px] mb-2">Acceptable ranges (this area only)</div>
      {opts.filter((m) => f.metrics.includes(m)).map((m) => (
        <div className="border border-line rounded-[10px] p-2.5 mb-2.5" key={m}>
          <b className="font-display">{M[m].n}{M[m].u && ` (${M[m].u.trim()})`}</b>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {SIDES[m].map((s) => (
              <Field key={s} label={LBL[s]} cls="mb-1">
                <input type="number" step="any" value={th[m][s]} onChange={(e) => setTh({ ...th, [m]: { ...th[m], [s]: e.target.value } })} />
              </Field>
            ))}
          </div>
          {err['t' + m] && <span className={ERR_TXT}>{err['t' + m]}</span>}
        </div>
      ))}
    </Modal>
  );
}

function AreaView({ d, a, onClose }) {
  const dv = devOf(d, a), th = thOf(d, a), farm = d.farms.find((f) => f.id === a.farm), st = areaStatus(d, a);
  return (
    <Modal title={a.name} onClose={onClose} foot={<button className={BTN} onClick={onClose}>Close</button>}>
      <dl className={KV_DL}>
        <dt className="text-mut">Status</dt><dd className="m-0"><StatusDot s={st} /></dd>
        <dt className="text-mut">Farm</dt><dd className="m-0">{farm?.name}</dd>
        <dt className="text-mut">Type</dt><dd className="m-0">{a.kind === 'garden' ? 'Garden' : 'Pond'} · {a.crop}</dd>
        <dt className="text-mut">Description</dt><dd className="m-0">{a.desc || '—'}</dd>
        <dt className="text-mut">ESP32 device</dt><dd className="m-0">{dv ? `${dv.code} (${dv.status}, last seen ${ago(dv.seen)})` : 'Not assigned'}</dd>
      </dl>
      <b className="font-display">Sensors and acceptable ranges</b>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px] mt-1.5">
          <thead>
            <tr className="text-left text-mut">
              <th className="py-1.5 pr-2 font-semibold">Sensor</th>
              <th className="py-1.5 pr-2 font-semibold">Reading</th>
              <th className="py-1.5 pr-2 font-semibold">Warning</th>
              <th className="py-1.5 font-semibold">Critical</th>
            </tr>
          </thead>
          <tbody>
            {metricsOf(a).map((m) => {
              const t = th[m] || {}, lv = level(m, a.r[m], th);
              return (
                <tr key={m} className="border-t border-line">
                  <td className="py-2 pr-2">{M[m].n}</td>
                  <td className="py-2 pr-2"><span className={pill(dv ? lv : 'unassigned')}>{a.r[m] ?? '—'}{M[m].u}</span></td>
                  <td className="py-2 pr-2">{[t.wl != null && `< ${t.wl}`, t.wh != null && `> ${t.wh}`].filter(Boolean).join(' or ')}</td>
                  <td className="py-2">{[t.cl != null && `< ${t.cl}`, t.ch != null && `> ${t.ch}`].filter(Boolean).join(' or ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

const TL = { cl: 'critical below', wl: 'warning below', wh: 'warning above', ch: 'critical above' };
function changeNotes(d, old, a) {
  if (!old) return [];
  const out = [], ot = thOf(d, old), dn = (id) => d.devices.find((v) => v.id === id)?.code || 'none';
  if ((old.dev || null) !== (a.dev || null)) out.push(`Changed ESP32 assignment of "${a.name}": ${dn(old.dev)} → ${dn(a.dev)}`);
  if (metricsOf(old).join() !== a.metrics.join()) out.push(`Changed sensors of "${a.name}": ${metricsOf(old).map((m) => M[m].n).join(', ')} → ${a.metrics.map((m) => M[m].n).join(', ')}`);
  a.metrics.forEach((m) => Object.keys(a.th[m] || {}).forEach((k) => { const o = (ot[m] || {})[k], v = a.th[m][k]; if (o !== v) out.push(`Changed threshold for "${a.name}": ${M[m].n} ${TL[k]} ${o ?? '—'} → ${v}`); }));
  return out;
}

export default function FarmManagement({ d, update, user }) {
  const role = user.role, canFarm = role === 'Owner', canArea = can(user, 'farms'), canDel = role === 'Owner';
  const [q, setQ] = useState(''), [tab, setTab] = useState('all'), [mod, setMod] = useState(null), [toast, setToast] = useState('');
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const close = () => setMod(null);

  const saveFarm = (f) => {
    update((n) => { if (f.id) Object.assign(n.farms.find((x) => x.id === f.id), f); else n.farms.push({ ...f, id: 'f' + now() }); }, `${f.id ? 'Edited' : 'Added'} farm "${f.name}"`, user.name);
    close(); say(f.id ? 'Farm updated.' : 'Farm added.');
  };
  const saveArea = (a) => {
    const old = a.id ? d.areas.find((x) => x.id === a.id) : null, notes = changeNotes(d, old, a);
    update((n) => {
      notes.forEach((t) => addLog(n, t, user.name));
      if (old) a.metrics.forEach((m) => { const ob = thOf(d, old)[m] || {}, nb = a.th[m] || {}; if (thDiff(ob, nb)) recordTh(n, user.name, a.name, m, ob, nb); });
      if (a.id) Object.assign(n.areas.find((x) => x.id === a.id), a);
      else n.areas.push({ ...a, id: 'a' + now(), r: {}, h: {} });
    }, `${a.id ? 'Edited' : 'Added'} ${a.kind} "${a.name}"`, user.name);
    close(); say(a.id ? 'Area updated.' : 'Area added.');
  };
  const remove = () => {
    const { kind, item } = mod;
    update((n) => {
      if (kind === 'farm') { n.farms = n.farms.filter((x) => x.id !== item.id); n.areas = n.areas.filter((x) => x.farm !== item.id); }
      else n.areas = n.areas.filter((x) => x.id !== item.id);
      n.sensors = (n.sensors || []).map((s) => (n.areas.some((x) => x.id === s.area) ? s : { ...s, area: null }));
    }, `Deleted ${kind} "${item.name}"`, user.name);
    close(); say('Deleted.');
  };

  const match = (a) => (tab === 'all' || a.kind === tab) && (!q || `${a.name} ${a.crop}`.toLowerCase().includes(q.toLowerCase()));
  const rows = d.farms.map((f) => ({ f, ar: d.areas.filter((a) => a.farm === f.id && match(a)) })).filter((x) => x.ar.length || (!q && tab === 'all'));

  return (
    <div className={PG}>
      <div className={BAR2}>
        <div className={INNER_TABS} role="tablist">
          {[['all', 'All'], ['garden', 'Gardens'], ['pond', 'Ponds']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={innerTab(tab === k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className={ACTS}>
          <input className={INP} type="search" placeholder="Search area or crop" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          {canFarm && <button className={BTN_P} onClick={() => setMod({ t: 'farm' })}>+ Add farm</button>}
        </div>
      </div>

      {rows.length === 0 && (
        <div className={CARD}>
          <p className="text-mut">{d.farms.length ? 'No areas match your search.' : 'No farms yet.'}{canFarm && !d.farms.length ? ' Use “Add farm” to start.' : ''}</p>
        </div>
      )}

      {rows.map(({ f, ar }) => (
        <div className={CARD} key={f.id}>
          <div className="flex flex-col sm:flex-row justify-between gap-2.5 flex-wrap items-start mb-3">
            <div>
              <h2 className="text-[16px] font-bold font-display mb-0.5">{f.name}</h2>
              <div className="text-mut text-[13px]">{f.loc} · {d.areas.filter((a) => a.farm === f.id).length} monitoring areas{f.desc && ` · ${f.desc}`}</div>
            </div>
            <div className={ACTS}>
              {canArea && (
                <>
                  <button className={BTN_SM} onClick={() => setMod({ t: 'area', farmId: f.id, kind: 'garden' })}>+ Garden</button>
                  <button className={BTN_SM} onClick={() => setMod({ t: 'area', farmId: f.id, kind: 'pond' })}>+ Pond</button>
                </>
              )}
              {canFarm && <button className={BTN_SM} onClick={() => setMod({ t: 'farm', farm: f })}>Edit farm</button>}
              {canDel && <button className={BTN_SM_D} onClick={() => setMod({ t: 'del', kind: 'farm', item: f })}>Delete</button>}
            </div>
          </div>
          {ar.length === 0 ? <p className="text-mut">No gardens or ponds yet.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
              {ar.map((a) => {
                const st = areaStatus(d, a), dv = devOf(d, a);
                return (
                  <div className={`${CARD} p-3.5 ${accent(st)}`} key={a.id}>
                    <div className="flex justify-between gap-2">
                      <div>
                        <b className="font-display">{a.name}</b>
                        <div className="text-mut text-[12px]">{a.kind === 'garden' ? 'Garden' : 'Pond'} · {a.crop}</div>
                      </div>
                      <StatusDot s={st} />
                    </div>
                    <div className="text-mut text-[13px] my-2">
                      {dv ? `${dv.code} (${dv.status})` : 'No device assigned'} · {metricsOf(a).map((m) => M[m].n).join(', ')}
                    </div>
                    <div className={ACTS}>
                      <button className={BTN_SM} onClick={() => setMod({ t: 'view', id: a.id })}>View</button>
                      {canArea && <button className={BTN_SM} onClick={() => setMod({ t: 'area', farmId: f.id, area: a })}>Edit</button>}
                      {canDel && <button className={BTN_SM_D} onClick={() => setMod({ t: 'del', kind: a.kind, item: a })}>Delete</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {mod?.t === 'farm' && <FarmForm farm={mod.farm} onSave={saveFarm} onClose={close} />}
      {mod?.t === 'area' && <AreaForm d={d} farmId={mod.farmId} kind={mod.kind} area={mod.area} onSave={saveArea} onClose={close} />}
      {mod?.t === 'view' && d.areas.find((a) => a.id === mod.id) && <AreaView d={d} a={d.areas.find((a) => a.id === mod.id)} onClose={close} />}
      {mod?.t === 'del' && (
        <Modal title={`Delete ${mod.kind}?`} onClose={close} foot={<><button className={BTN} onClick={close}>Cancel</button><button className={BTN_CRIT} onClick={remove}>Delete</button></>}>
          <p>“{mod.item.name}” will be removed{mod.kind === 'farm' ? ` together with its ${d.areas.filter((a) => a.farm === mod.item.id).length} monitoring area(s)` : ''}. This cannot be undone.</p>
        </Modal>
      )}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bg-ink text-white px-4 py-2.5 rounded-[10px] z-20 text-[14px] shadow-lg"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

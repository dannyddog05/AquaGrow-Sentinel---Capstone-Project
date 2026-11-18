import { devOf } from '../data/db';

/**
 * Pure selector deriving EquipmentView[] from existing pump/device state.
 * Only includes equipment that actually exists in `d.pumps` (never faked).
 */
export function buildEquipmentList(d) {
  if (!d || !Array.isArray(d.pumps)) return [];
  return d.pumps.map((p) => {
    const area = (d.areas || []).find((a) => a.id === p.area);
    const dv = area ? devOf(d, area) : null;
    const name = area ? `${area.name} pump` : p.id;

    let state = 'off';
    if (!dv || dv.status !== 'online') {
      state = 'offline';
    } else if (p.locked || (p.cmds && p.cmds[0]?.status === 'failed')) {
      state = 'fault';
    } else if (p.state === 'on') {
      state = 'running';
    }

    const mode = state === 'offline' || state === 'fault' ? null : p.auto?.enabled ? 'auto' : 'manual';

    return { id: p.id, name, state, mode };
  });
}

const STATE_LABEL = {
  running: 'Running',
  off: 'Off',
  offline: 'Offline',
  fault: 'Fault',
};

const MODE_LABEL = {
  auto: 'Auto',
  manual: 'Manual',
};

export function formatEquipmentState(state, mode) {
  const s = STATE_LABEL[state] || state;
  if (!mode || !MODE_LABEL[mode]) return s;
  return `${s} · ${MODE_LABEL[mode]}`;
}

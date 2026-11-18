import { useCallback, useMemo, useState } from 'react';
import AreaSection from './AreaSection';
import Chart from './Chart';
import EquipmentPanel from './EquipmentPanel';
import OpenAlertsPanel from './OpenAlertsPanel';
import { CARD_H2, Card, PG, STATUS_BG, StatCard, StatStrip, StatusBadge } from './ui';
import { M } from '../data/constants';
import { areaStatus, ago, can, metricsOf, now, thOf } from '../data/db';
import { buildEquipmentList } from '../lib/equipment';
import { useAreaMetrics } from '../lib/readingStatus';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const fmtTime = (t) =>
  t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

function ConnectedAreaSection({ d, area, selectedMetricKey, onSelectMetric }) {
  const metrics = useAreaMetrics(d, area.id);
  const title = area.kind === 'pond' ? 'Aquaculture' : 'Garden';

  return (
    <AreaSection
      title={title}
      subtitle={area.name}
      detailsHref="/farms-devices?tab=farms"
      metrics={metrics}
      gridKind={area.kind}
      areaId={area.id}
      selectedMetricKey={selectedMetricKey}
      onSelectMetric={onSelectMetric}
    />
  );
}

function StatusBanner({ alerts, offlineDevices }) {
  const crit = alerts.filter((x) => x.sev === 'critical').length;
  const warn = alerts.filter((x) => x.sev === 'warning').length;
  const offAlerts = alerts.filter((x) => x.sev === 'offline').length;

  let tone = 'bg-banner-ok/92 border-banner-ok-border text-banner-ok-ink';
  let lead = 'All systems normal.';
  let detail = 'Every reading is within its safe range.';
  let icon = (
    <svg className="w-5 h-5 flex-none text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5.2" />
    </svg>
  );

  if (crit > 0) {
    tone = 'bg-banner-crit/92 border-banner-crit-border text-banner-crit-ink';
    lead = `${crit} critical ${crit === 1 ? 'alert' : 'alerts'}.`;
    detail = warn > 0
      ? `${warn} ${warn === 1 ? 'reading also needs' : 'readings also need'} attention.`
      : 'Immediate review recommended.';
    icon = (
      <svg className="w-5 h-5 flex-none text-crit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <line x1="12" y1="8" x2="12" y2="12.5" />
        <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      </svg>
    );
  } else if (warn > 0) {
    tone = 'bg-banner-warn/92 border-banner-warn-border text-banner-warn-ink';
    lead = `${warn} ${warn === 1 ? 'reading needs' : 'readings need'} attention.`;
    detail = 'Check warning sensors before they reach critical thresholds.';
    icon = (
      <svg className="w-5 h-5 flex-none text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  } else if (offAlerts > 0 || offlineDevices > 0) {
    const count = Math.max(offAlerts, offlineDevices);
    tone = 'bg-banner-off/92 border-banner-off-border text-banner-off-ink';
    lead = `${count} ${count === 1 ? 'device is' : 'devices are'} offline.`;
    detail = 'Some sensors are not reporting live readings.';
    icon = (
      <svg className="w-5 h-5 flex-none text-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    );
  }

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[14px] shadow-[0_2px_10px_rgba(18,48,42,0.05)] backdrop-blur-sm ${tone}`}
    >
      <span aria-hidden="true">{icon}</span>
      <p className="m-0 leading-snug">
        <strong className="font-semibold">{lead}</strong>{' '}
        <span className="opacity-90">{detail}</span>
      </p>
    </div>
  );
}

export default function Dashboard({ d, update, user, onOpenDrawer }) {
  const ponds = d.areas.filter((a) => a.kind === 'pond');
  const gardens = d.areas.filter((a) => a.kind === 'garden');
  const cnt = (s) => d.devices.filter((x) => x.status === s).length;
  const al = d.alertRecs
    .filter((x) => x.status !== 'resolved')
    .sort((a, b) => (b.sev === 'critical') - (a.sev === 'critical') || b.t - a.t);
  const [aid, setAid] = useState(d.areas[0]?.id);
  const area = d.areas.find((a) => a.id === aid) || d.areas[0], ms = area ? metricsOf(area) : [];
  const [met, setMet] = useState('');
  const mm = ms.includes(met) ? met : ms[0];
  const healthy = Math.round((d.areas.filter((a) => areaStatus(d, a) === 'normal').length / (d.areas.length || 1)) * 100);
  const allReadingsSafe = d.areas.length > 0 && d.areas.every((a) => areaStatus(d, a) === 'normal');

  const canActOnAlerts = can(user, 'alerts');
  const equipment = useMemo(() => buildEquipmentList(d), [d]);

  const handleSelectMetric = useCallback((areaId, metricKey) => {
    setAid(areaId);
    setMet(metricKey);
  }, []);

  const handleAcknowledge = useCallback(
    (r) => {
      if (!update) return;
      update(
        (n) => {
          const x = n.alertRecs.find((q) => q.id === r.id);
          if (!x) return;
          x.status = 'ack';
          x.ackAt = now();
          x.ackBy = user.name;
          x.tl.push({ t: now(), by: user.name, type: 'sys', text: 'Acknowledged' });
        },
        `Acknowledged alert "${r.title}"`,
        user.name
      );
    },
    [update, user.name]
  );

  const handleResolve = useCallback(
    (r) => {
      if (!update) return;
      update(
        (n) => {
          const x = n.alertRecs.find((q) => q.id === r.id);
          if (!x) return;
          x.status = 'resolved';
          x.resolvedAt = now();
          x.resolvedBy = user.name;
          x.hold = false;
          x.auto = false;
          x.tl.push({ t: now(), by: user.name, type: 'sys', text: 'Resolved' });
          n.snooze[x.key] = now() + 5 * 60000;
        },
        `Resolved alert "${r.title}"`,
        user.name
      );
    },
    [update, user.name]
  );

  const lastSynced = Math.max(
    0,
    ...d.areas.map((a) => a.rt || 0),
    ...d.devices.map((dv) => dv.seen || 0),
    d.sync?.last || 0
  );

  return (
    <div className={`${PG} pt-5 lg:pt-7 pb-8`}>
      {/* Greeting header + live sync chip */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {onOpenDrawer && (
            <button
              type="button"
              onClick={onOpenDrawer}
              aria-label="Open navigation menu"
              className="lg:hidden border border-line bg-white/85 backdrop-blur-sm rounded-[10px] w-10 h-10 grid place-items-center text-[18px] text-ink shadow-sm hover:bg-brand-soft flex-none mt-0.5 transition-colors"
            >
              ☰
            </button>
          )}
          <div>
            <h1 className="font-display font-bold text-[26px] sm:text-[30px] leading-tight tracking-[-0.02em] text-ink m-0">
              {greeting()}
            </h1>
            <p className="text-[14px] text-mut mt-0.5 mb-0">
              Real-time status of your pond and garden.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/70 shadow-sm text-[12.5px] font-medium text-ink whitespace-nowrap">
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-brand flex-none" />
          <span className="font-semibold text-ink">Live</span>
          <span className="text-mut">·</span>
          <span className="text-ink/80">synced {fmtTime(lastSynced)}</span>
        </div>
      </header>

      {/* Dynamic status banner driven by live alerts & device connectivity */}
      <StatusBanner alerts={al} offlineDevices={cnt('offline') + cnt('disconnected')} />

      {/* Live reading cards: Aquaculture and Garden sections */}
      <div className="grid gap-5">
        {ponds.map((a) => (
          <ConnectedAreaSection
            key={a.id}
            d={d}
            area={a}
            selectedMetricKey={area?.id === a.id ? mm : null}
            onSelectMetric={handleSelectMetric}
          />
        ))}
        {gardens.map((a) => (
          <ConnectedAreaSection
            key={a.id}
            d={d}
            area={a}
            selectedMetricKey={area?.id === a.id ? mm : null}
            onSelectMetric={handleSelectMetric}
          />
        ))}
      </div>

      {/* Bottom primary panels: Open alerts (13fr) + Equipment (7fr) */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <OpenAlertsPanel
          alerts={d.alertRecs}
          areas={d.areas}
          canAct={canActOnAlerts}
          allReadingsSafe={allReadingsSafe}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
        <EquipmentPanel items={equipment} />
      </div>

      {/* Summary strip */}
      <StatStrip className="rounded-2xl border-slate-200 shadow-sm">
        <StatCard value={d.farms.length} label="Farms" sub={`${gardens.length} gardens · ${ponds.length} ponds`} />
        <StatCard value={d.areas.length} label="Monitoring areas" sub={`${gardens.length} gardens · ${ponds.length} ponds`} />
        <StatCard value={cnt('online')} label="Online ESP32" sub={`${cnt('offline')} offline · ${cnt('disconnected')} disc.`} />
        <StatCard value={al.length} label="Active alerts" sub={`${al.filter((x) => x.sev === 'critical').length} crit · ${al.filter((x) => x.sev === 'warning').length} warn`} />
        <StatCard value={`${healthy}%`} label="System health" sub={`Synced ${fmtTime(lastSynced)}`} />
      </StatStrip>

      {/* Sensor trend chart */}
      <Card className="rounded-2xl border-slate-200 shadow-sm p-5">
        <h2 className={CARD_H2}>
          Sensor trend
          <span className="flex gap-2 flex-wrap">
            <select className="border border-line rounded-lg px-2.5 py-1.5 bg-white text-sm font-normal" aria-label="Area" value={aid} onChange={(e) => setAid(e.target.value)}>
              {d.areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="border border-line rounded-lg px-2.5 py-1.5 bg-white text-sm font-normal" aria-label="Sensor" value={mm} onChange={(e) => setMet(e.target.value)}>
              {ms.map((m) => <option key={m} value={m}>{M[m].n}</option>)}
            </select>
          </span>
        </h2>
        <Chart pts={(area && area.h[mm]) || []} u={mm ? M[mm].u : ''} th={area && mm ? thOf(d, area)[mm] : undefined} />
      </Card>

      {/* Farm health overview & recent notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)] gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm p-5">
          <h2 className={CARD_H2}>Farm health overview</h2>
          {d.farms.map((f) => {
            const ar = d.areas.filter((a) => a.farm === f.id);
            const ok = ar.filter((a) => areaStatus(d, a) === 'normal').length;
            const pc = ar.length ? (ok / ar.length) * 100 : 0;
            return (
              <div className="mb-3.5 last:mb-0" key={f.id}>
                <div className="flex justify-between text-[14px]">
                  <b className="font-display">{f.name}</b>
                  <span className="text-mut">{ok}/{ar.length} areas healthy</span>
                </div>
                <div className="h-2 rounded-full bg-[#e9efec] overflow-hidden my-1.5">
                  <i
                    className={`block h-full ${pc > 66 ? 'bg-ok' : pc > 33 ? 'bg-warn' : 'bg-crit'}`}
                    style={{ width: `${pc}%` }}
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {ar.map((a) => (
                    <StatusBadge key={a.id} status={areaStatus(d, a)}>{a.name}</StatusBadge>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm p-5">
          <h2 className={CARD_H2}>Recent notifications</h2>
          <div className="grid gap-1.5">
            {d.notifs.filter((n) => n.to?.includes(user.id)).slice(0, 6).map((n) => (
              <div className="flex gap-2.5 py-2 border-b border-line last:border-b-0 text-[14px]" key={n.id}>
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${STATUS_BG[n.sev] || 'bg-off'}`} />
                <div>
                  <b>{n.title}</b>
                  <div className="text-mut text-[13px]">{n.msg}</div>
                  <div className="text-mut text-[12px]">{ago(n.t)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

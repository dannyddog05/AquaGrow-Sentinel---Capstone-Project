import { useCallback, useEffect, useState } from 'react';
import { DBK } from '../data/constants';
import { addLog, migrate, syncTick, load, save, now, runEngine, pumpTick } from '../data/db';
import { feedTick, rt } from '../data/ingest';

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Returns [db, update, replace]. `update(fn, logMessage, userName)` mutates a copy, re-runs the alert engine, saves and logs.
 *  The timer simulates the ESP32 feed: every reading goes through the validation pipeline in data/ingest.js.
 *  Replace the timer with API / MQTT calls once a backend exists. */
export default function useDB() {
  const [d, setD] = useState(load);

  const update = useCallback((fn, msg, by) => setD((p) => {
    const n = clone(p);
    fn(n);
    runEngine(n);
    if (msg) n.logs = [{ id: 'l' + now(), t: now(), by: by || 'System', msg }, ...(n.logs || [])].slice(0, 500);
    save(n);
    return n;
  }), []);

  useEffect(() => {
    const id = setInterval(() => setD((p) => {
      const n = clone(p);
      feedTick(n);
      rt.live = true;
      pumpTick(n);
      syncTick(n);
      runEngine(n);
      save(n);
      return n;
    }), 4000);
    return () => clearInterval(id);
  }, []);

  const replace = useCallback((data, msg, by) => setD(() => { const n = migrate(clone(data)); if (msg) addLog(n, msg, by); save(n); return n; }), []);
  return [d, update, replace];
}
export const resetDB = () => { try { localStorage.removeItem(DBK); } catch (e) {} location.reload(); };

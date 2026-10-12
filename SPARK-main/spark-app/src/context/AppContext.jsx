import React, {
  createContext, useContext, useState, useCallback,
  useEffect, useRef,
} from 'react';
import { BUILDINGS, ROOMS, campuses as SEED_CAMPUSES, ZONES as SEED_ZONES, SEED_ACTIONS, SEED_REPORTS, buildFoodData } from '../data/seed';
import {
  supabase,
  fetchReports, insertReport, verifyReport as dbVerifyReport,
  fetchActions, insertAction, patchAction,
  fetchOccupancyAlerts, ackAlert,
  subscribeAlerts, subscribeReports,
  fetchLatestOccupancy,
  fetchCampuses, fetchZones, fetchBuildings, fetchRooms, fetchEnergyReadings,
  insertOccupancyReading, insertOccupancyAlert, subscribeOccupancyReadings
} from '../lib/supabase';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const foodSeed = buildFoodData();

// ── Connectivity check ────────────────────────────────────────────────────────
async function checkSupabase() {
  try {
    const { error } = await supabase.from('zones').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export function AppProvider({ children }) {
  const [role, setRole]                 = useState(null);
  const [campus, setCampus]             = useState(0);
  const [occOverrides, setOcc]          = useState({});
  const [actions, setActions]           = useState(SEED_ACTIONS);
  const [reports, setReports]           = useState(SEED_REPORTS);
  const [buildings, setBuildings]       = useState(BUILDINGS);
  const [rooms, setRooms]               = useState(ROOMS);
  const [campusesList, setCampusesList] = useState(SEED_CAMPUSES);
  const [zonesList, setZonesList]       = useState(SEED_ZONES);
  const [energyReadings, setEnergy]     = useState([]);
  const [sessions, setSessions]         = useState(foodSeed.sessions);
  const [wasteRec, setWasteRec]         = useState(foodSeed.wasteRecords);
  const [stock, setStock]               = useState(foodSeed.stock);
  const [occLog, setOccLog]             = useState([]);
  const [nid, setNid]                   = useState(20);
  const [dbConnected, setDbConnected]   = useState(false);   // Supabase online?
  const [dbLoading, setDbLoading]       = useState(true);
  const [occAlerts, setOccAlerts]       = useState([]);       // Camera alerts
  const [liveOcc, setLiveOcc]           = useState({});       // latest reading per zone
  const channelRefs = useRef([]);

  const nextId = useCallback(() => { const id = nid; setNid(n => n + 1); return id; }, [nid]);

  // ── Bootstrap: check DB, load real data, subscribe ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const ok = await checkSupabase();
      if (cancelled) return;
      setDbConnected(ok);

      if (ok) {
        // Load all data from Supabase (replacing mock/dummy data with real DB records)
        try {
          const [
            dbReports,
            dbActions,
            dbAlerts,
            dbOcc,
            dbCampuses,
            dbZones,
            dbBuildings,
            dbRooms,
            dbEnergy,
          ] = await Promise.all([
            fetchReports().catch(() => []),
            fetchActions().catch(() => []),
            fetchOccupancyAlerts().catch(() => []),
            fetchLatestOccupancy().catch(() => ({})),
            fetchCampuses().catch(() => []),
            fetchZones().catch(() => []),
            fetchBuildings().catch(() => []),
            fetchRooms().catch(() => []),
            fetchEnergyReadings('main').catch(() => []),
          ]);

          if (!cancelled) {
            if (dbReports.length > 0) setReports(dbReports);
            if (dbActions.length > 0) setActions(dbActions);
            if (dbAlerts.length > 0)  setOccAlerts(dbAlerts);
            if (dbCampuses.length > 0) setCampusesList(dbCampuses);
            if (dbZones.length > 0)    setZonesList(dbZones);
            if (dbBuildings.length > 0) setBuildings(dbBuildings);
            if (dbRooms.length > 0)     setRooms(dbRooms);
            if (dbEnergy.length > 0)    setEnergy(dbEnergy);

            // Build occOverrides from latest live readings
            const overrides = {};
            for (const [zoneId, reading] of Object.entries(dbOcc)) {
              overrides[zoneId] = reading.people;
            }
            setOcc(overrides);
            setLiveOcc(dbOcc);
          }
        } catch (err) {
          console.error('[SPARK] Failed to load from Supabase:', err);
        }

        // Real-time: new camera occupancy alerts
        const alertCh = subscribeAlerts(newAlert => {
          setOccAlerts(prev => {
            const exists = prev.some(a => a.id === newAlert.id);
            return exists ? prev : [newAlert, ...prev];
          });
          document.title = `⚠ SPARK — Empty room alert: ${newAlert.zone_id}`;
          setTimeout(() => { document.title = 'SPARK'; }, 5000);
        });

        // Real-time: new waste reports
        const reportCh = subscribeReports(newRep => {
          setReports(prev => [{
            id: newRep.id, zone: newRep.zone_id, cat: newRep.category,
            desc: newRep.description || '', age: 0, verified: false, n: 1,
          }, ...prev]);
        });

        // Real-time: new occupancy readings
        const occCh = subscribeOccupancyReadings(newReading => {
          setLiveOcc(prev => ({ ...prev, [newReading.zone_id]: newReading }));
          setOcc(prev => ({ ...prev, [newReading.zone_id]: newReading.people }));
        });

        channelRefs.current = [alertCh, reportCh, occCh];
      }

      setDbLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
      channelRefs.current.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  // ── Periodic refresh of live occupancy ────────────────────────────────────
  useEffect(() => {
    if (!dbConnected) return;
    const interval = setInterval(async () => {
      try {
        const dbOcc = await fetchLatestOccupancy();
        setLiveOcc(dbOcc);
        const overrides = {};
        for (const [zoneId, reading] of Object.entries(dbOcc)) {
          overrides[zoneId] = reading.people;
        }
        setOcc(prev => ({ ...prev, ...overrides }));
      } catch { /* silent */ }
    }, 20_000);
    return () => clearInterval(interval);
  }, [dbConnected]);

  // ── Add a waste report ────────────────────────────────────────────────────
  const addReport = useCallback(async (zone, cat, desc) => {
    // Optimistic update
    setReports(prev => {
      const same = prev.find(r => r.zone === zone && r.cat === cat && r.age === 0);
      if (same) return prev.map(r => r === same ? { ...r, n: (r.n || 1) + 1 } : r);
      return [{ id: nextId(), zone, cat, desc, age: 0, verified: false }, ...prev];
    });
    // Persist
    if (dbConnected) {
      try { await insertReport({ zone, cat, desc }); }
      catch (e) { console.error('[SPARK] insertReport failed:', e); }
    }
  }, [nextId, dbConnected]);

  // ── Verify a report ───────────────────────────────────────────────────────
  const verifyReport = useCallback(async (id) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, verified: true } : r));
    if (dbConnected) {
      try { await dbVerifyReport(id); }
      catch (e) { console.error('[SPARK] verifyReport failed:', e); }
    }
  }, [dbConnected]);

  // ── Create action ──────────────────────────────────────────────────────────
  const createAction = useCallback(async ({ zone, rule, title }) => {
    const pri = rule === 'R1' ? 'High' : 'Medium';
    const due = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const tempAction = { id: nextId(), zone, rule, title, owner: 'Facilities', pri, due, status: 'Open', note: '' };
    setActions(prev => [tempAction, ...prev]);

    if (dbConnected) {
      try {
        const saved = await insertAction({ zone, rule, title });
        setActions(prev => prev.map(a => a.id === tempAction.id ? saved : a));
        return saved;
      } catch (e) {
        console.error('[SPARK] insertAction failed:', e);
      }
    }
    return tempAction;
  }, [nextId, dbConnected]);

  // ── Update action ─────────────────────────────────────────────────────────
  const updateAction = useCallback(async (id, patch) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    if (dbConnected) {
      try { await patchAction(id, patch); }
      catch (e) { console.error('[SPARK] patchAction failed:', e); }
    }
  }, [dbConnected]);

  // ── Acknowledge camera alert ──────────────────────────────────────────────
  const acknowledgeAlert = useCallback(async (id) => {
    setOccAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    if (dbConnected) {
      try { await ackAlert(id); }
      catch (e) { console.error('[SPARK] ackAlert failed:', e); }
    }
  }, [dbConnected]);

  // ── Trigger OpenCV.js Empty Room Alert ─────────────────────────────────────
  const triggerOpenCvAlert = useCallback(async ({
    zone_id = 'lab',
    campus_id = 'main',
    alert_type = 'EMPTY_ROOM_POWER_ON',
    severity = 'High',
    people_count = 0,
    message,
  }) => {
    const alertMsg = message || `Camera alert: Zone '${zone_id}' has 0 people detected while power is on (OpenCV.js).`;
    const tempAlert = {
      id: 'local-' + Date.now(),
      zone_id,
      campus_id,
      alert_type,
      severity,
      people_count,
      message: alertMsg,
      ts: new Date().toISOString(),
      acknowledged: false,
    };
    setOccAlerts(prev => [tempAlert, ...prev]);

    if (dbConnected) {
      try {
        const saved = await insertOccupancyAlert({
          zone_id,
          campus_id,
          alert_type,
          severity,
          people_count,
          message: alertMsg,
        });
        if (saved) {
          setOccAlerts(prev => prev.map(a => a.id === tempAlert.id ? saved : a));
        }
        return saved;
      } catch (err) {
        console.error('[SPARK] Failed to push OpenCV alert to Supabase:', err);
      }
    }
    return tempAlert;
  }, [dbConnected]);

  // ── Record OpenCV.js Occupancy Reading ────────────────────────────────────
  const recordOpenCvReading = useCallback(async ({
    zone_id = 'lab',
    campus_id = 'main',
    people = 0,
    confidence = 0.95,
    source = 'opencv.js',
  }) => {
    const now = new Date();
    const h = now.getHours();
    const is_after_hours = (h >= 22 || h < 5);
    const reading = { zone_id, campus_id, people, ts: now.toISOString(), source, confidence, is_after_hours };

    setLiveOcc(prev => ({ ...prev, [zone_id]: reading }));
    setOcc(prev => ({ ...prev, [zone_id]: people }));

    if (dbConnected) {
      try {
        await insertOccupancyReading({
          zone_id,
          campus_id,
          people,
          confidence,
          source,
          is_after_hours,
        });
      } catch (err) {
        console.error('[SPARK] Failed to push OpenCV reading to Supabase:', err);
      }
    }
  }, [dbConnected]);

  // ── Ingest occupancy JSON lines (manual paste / YOLO file) ────────────────
  const ingestOcc = useCallback(text => {
    const lines = text.trim().split('\n');
    let accepted = 0, rejected = 0;
    const errors = [];
    lines.forEach(ln => {
      try {
        const obj = JSON.parse(ln);
        if (!obj.zone || obj.people == null || !obj.ts) throw new Error('Missing field');
        if (obj.people < 0) throw new Error('Negative people');
        const h = new Date(obj.ts).getHours();
        if (isNaN(h)) throw new Error('Invalid timestamp');
        if (h >= 22 || h < 5) {
          setOcc(prev => ({ ...prev, [obj.zone]: obj.people }));
          setOccLog(prev => [{ ...obj, accepted: true }, ...prev]);
          accepted++;
        } else {
          setOccLog(prev => [{ ...obj, accepted: false, reason: 'Not after-hours' }, ...prev]);
          accepted++;
        }
      } catch (e) {
        rejected++;
        errors.push(e.message);
      }
    });
    return { accepted, rejected, errors };
  }, []);

  // ── Food functions ────────────────────────────────────────────────────────
  const closeSession = useCallback((sessionId, actualDiners) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'Closed', actual: actualDiners } : s));
  }, []);

  const addWaste = useCallback((record) => {
    setWasteRec(prev => [{ id: `WR-${nextId()}`, ...record }, ...prev]);
  }, [nextId]);

  const discardStock = useCallback((stockId) => {
    setStock(prev => prev.filter(s => s.id !== stockId));
    setWasteRec(prev => [{
      id: `WR-stk-${nextId()}`, sessionId: 'stock', item: 'Stock spoilage',
      category: 'Spoiled / expired stock', reason: 'Spoilage', qty: 0,
      disposition: 'General disposal', note: 'Logged from stock expiry',
    }, ...prev]);
  }, [nextId]);

  const value = {
    role, setRole, campus, setCampus,
    campusesList, zonesList,
    buildings, rooms, energyReadings,
    occOverrides, setOcc,
    actions, createAction, updateAction,
    reports, addReport, verifyReport,
    sessions, wasteRec, stock,
    closeSession, addWaste, discardStock,
    occLog, ingestOcc,
    menu: foodSeed.menu,
    // Supabase & OpenCV live state & actions
    dbConnected, dbLoading,
    occAlerts, acknowledgeAlert,
    liveOcc,
    triggerOpenCvAlert, recordOpenCvReading,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

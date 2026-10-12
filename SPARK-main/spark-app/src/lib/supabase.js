// ── Supabase client ─────────────────────────────────────────────────────────
// Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in spark-app/.env
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://dvujisiunmerilnhsmft.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON) {
  console.warn(
    '[SPARK] VITE_SUPABASE_ANON_KEY is not set.\n' +
    'Find it in Supabase Dashboard → Project Settings → API → anon/public key.\n' +
    'Add it to spark-app/.env as VITE_SUPABASE_ANON_KEY=eyJ...'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch all waste reports ordered by creation date */
export async function fetchReports() {
  const { data, error } = await supabase
    .from('waste_reports')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Map DB shape → app shape
  return (data || []).map(r => ({
    id:       r.id,
    zone:     r.zone_id,
    cat:      r.category,
    desc:     r.description || '',
    age:      r.age_days,
    verified: r.verified,
    n:        1,
  }));
}

/** Insert or merge a waste report */
export async function insertReport({ zone, cat, desc }) {
  // Check for same-day duplicate
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('waste_reports')
    .select('id, age_days')
    .eq('zone_id', zone)
    .eq('category', cat)
    .eq('age_days', 0)
    .limit(1);

  if (existing && existing.length > 0) {
    // already reported today — just return existing
    return existing[0].id;
  }

  const { data, error } = await supabase
    .from('waste_reports')
    .insert({ zone_id: zone, category: cat, description: desc, age_days: 0 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Verify a waste report */
export async function verifyReport(id, verifiedBy = 'Staff') {
  const { error } = await supabase
    .from('waste_reports')
    .update({ verified: true, verified_by: verifiedBy, verified_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Fetch all actions */
export async function fetchActions() {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(a => ({
    id:          a.id,
    zone:        a.zone_id,
    rule:        a.rule_code,
    title:       a.title,
    owner:       a.owner || 'Facilities',
    pri:         a.priority,
    due:         a.due_date,
    status:      a.status,
    note:        a.note || '',
    resolvedAt:  a.resolved_at,
    baselineAvg: a.baseline_avg,
    postAvg:     a.post_avg,
  }));
}

/** Create a new action */
export async function insertAction({ zone, rule, title }) {
  const pri = rule === 'R1' ? 'High' : 'Medium';
  const due = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('actions')
    .insert({ zone_id: zone, rule_code: rule, title, owner: 'Facilities', priority: pri, due_date: due })
    .select('*')
    .single();
  if (error) throw error;
  return {
    id: data.id, zone: data.zone_id, rule: data.rule_code,
    title: data.title, owner: data.owner, pri: data.priority,
    due: data.due_date, status: data.status, note: '',
  };
}

/** Update action status / note */
export async function patchAction(id, patch) {
  const update = {};
  if (patch.status)     update.status      = patch.status;
  if (patch.note)       update.note        = patch.note;
  if (patch.resolvedAt) update.resolved_at = patch.resolvedAt;
  const { error } = await supabase.from('actions').update(update).eq('id', id);
  if (error) throw error;
}

/** Fetch latest occupancy alerts (last 50, unacknowledged first) */
export async function fetchOccupancyAlerts() {
  const { data, error } = await supabase
    .from('occupancy_alerts')
    .select('*')
    .order('ts', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

/** Acknowledge an occupancy alert */
export async function ackAlert(id, by = 'Admin') {
  const { error } = await supabase
    .from('occupancy_alerts')
    .update({ acknowledged: true, ack_by: by, ack_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Subscribe to real-time occupancy alerts */
export function subscribeAlerts(onInsert) {
  return supabase
    .channel('occupancy_alerts_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'occupancy_alerts' }, payload => {
      onInsert(payload.new);
    })
    .subscribe();
}

/** Subscribe to real-time waste reports */
export function subscribeReports(onInsert) {
  return supabase
    .channel('waste_reports_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waste_reports' }, payload => {
      onInsert(payload.new);
    })
    .subscribe();
}

/** Fetch latest occupancy reading per zone */
export async function fetchLatestOccupancy() {
  const { data, error } = await supabase
    .from('occupancy_readings')
    .select('zone_id, people, ts, source, confidence')
    .order('ts', { ascending: false })
    .limit(200);
  if (error) throw error;

  // Collapse to latest per zone
  const map = {};
  for (const row of (data || [])) {
    if (!map[row.zone_id]) map[row.zone_id] = row;
  }
  return map;  // { zone_id: { people, ts, source, confidence } }
}

/** Fetch all campuses */
export async function fetchCampuses() {
  const { data, error } = await supabase.from('campuses').select('*').order('id');
  if (error) throw error;
  return data || [];
}

/** Fetch all zones */
export async function fetchZones() {
  const { data, error } = await supabase.from('zones').select('*').order('id');
  if (error) throw error;
  return data || [];
}

/** Fetch all buildings from Supabase */
export async function fetchBuildings() {
  const { data, error } = await supabase.from('buildings').select('*').order('id');
  if (error) throw error;
  return (data || []).map(b => ({
    id: b.id,
    name: b.name,
    baseKwh: Number(b.base_kwh),
    sepKwh: Number(b.sep_kwh),
    rooms: b.rooms,
    wastage: Number(b.wastage),
    campusId: b.campus_id
  }));
}

/** Fetch all rooms from Supabase */
export async function fetchRooms() {
  const { data, error } = await supabase.from('rooms').select('*').order('id');
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    buildingId: r.building_id,
    building: r.building,
    usageToday: Number(r.usage_today),
    waste: Number(r.waste),
    occupancy: r.occupancy,
    issue: r.issue,
    assessment: r.assessment,
    owner: r.owner,
    status: r.status,
    lastClass: r.last_class
  }));
}

/** Fetch 14-day energy readings from Supabase */
export async function fetchEnergyReadings(campusId = 'main') {
  const { data, error } = await supabase
    .from('energy_readings')
    .select('*')
    .eq('campus_id', campusId)
    .order('reading_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Insert an occupancy reading from browser OpenCV.js or camera agent */
export async function insertOccupancyReading({ zone_id, campus_id = 'main', people, confidence = 0.95, source = 'opencv.js', is_after_hours = false }) {
  const ts = new Date().toISOString();
  const { data, error } = await supabase
    .from('occupancy_readings')
    .insert([{
      zone_id,
      campus_id,
      ts,
      people,
      source,
      confidence,
      is_after_hours
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Insert an occupancy alert from OpenCV.js when empty room detected */
export async function insertOccupancyAlert({ zone_id, campus_id = 'main', alert_type = 'EMPTY_ROOM_POWER_ON', severity = 'High', people_count = 0, message, frame_path = null }) {
  const ts = new Date().toISOString();
  const { data, error } = await supabase
    .from('occupancy_alerts')
    .insert([{
      zone_id,
      campus_id,
      alert_type,
      severity,
      people_count,
      message,
      frame_path,
      ts,
      acknowledged: false
    }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Subscribe to real-time occupancy readings */
export function subscribeOccupancyReadings(onInsert) {
  return supabase
    .channel('occupancy_readings_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'occupancy_readings' }, payload => {
      onInsert(payload.new);
    })
    .subscribe();
}


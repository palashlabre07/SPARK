import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (req, res) {
  try {
    const [rooms, alerts, deviceSummary, latestObservations] = await Promise.all([
      db.query("SELECT r.id, r.name, r.category, r.building, r.floor_label, r.capacity, r.schedule_label, COALESCE(o.occupancy_status,'unknown') AS occupancy_status, o.observed_at AS occupancy_observed_at, COALESCE(o.source,'simulated') AS occupancy_source, (SELECT COUNT(*) FROM devices d WHERE d.room_id=r.id) AS device_count FROM rooms r LEFT JOIN LATERAL (SELECT occupancy_status, observed_at, source FROM observations WHERE room_id=r.id ORDER BY observed_at DESC LIMIT 1) o ON TRUE ORDER BY r.category, r.name"),
      db.query("SELECT a.id, a.room_id, r.name AS room_name, r.category, a.device_id, d.name AS device_name, a.severity, a.status, a.title, a.description, a.estimated_kwh, a.estimated_cost, a.recommendation, a.verification_status, a.observed_at, a.created_at FROM alerts a JOIN rooms r ON r.id=a.room_id LEFT JOIN devices d ON d.id=a.device_id ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, a.created_at DESC LIMIT 30"),
      db.query("SELECT COUNT(*) AS device_count, COUNT(*) FILTER (WHERE latest_status='on') AS devices_on, COALESCE(SUM(rated_watts),0)*4/1000 AS estimated_consumption_kwh FROM (SELECT d.id,d.rated_watts,(SELECT status FROM device_observations x WHERE x.device_id=d.id ORDER BY observed_at DESC LIMIT 1) AS latest_status FROM devices d) s"),
      db.query("SELECT COUNT(*) FILTER (WHERE occupancy_status='occupied') AS occupied_rooms, COUNT(*) FILTER (WHERE occupancy_status='unoccupied') AS unoccupied_rooms FROM (SELECT DISTINCT ON (room_id) room_id, occupancy_status FROM observations ORDER BY room_id, observed_at DESC) latest")
    ]);
    const openAlerts = alerts.rows.filter(a => ['open','verified'].includes(a.status));
    const wasteKwh = openAlerts.reduce((sum,a) => sum + Number(a.estimated_kwh || 0),0);
    const wasteCost = openAlerts.reduce((sum,a) => sum + Number(a.estimated_cost || 0),0);
    res.json({ generatedAt: new Date().toISOString(), dataMode: 'synthetic_demo', tariffPerKwh: 8, stats: { totalRooms: rooms.rows.length, occupiedRooms: Number(latestObservations.rows[0]?.occupied_rooms || 0), unoccupiedRooms: Number(latestObservations.rows[0]?.unoccupied_rooms || 0), roomsWithPotentialWaste: new Set(openAlerts.map(a=>a.room_id)).size, estimatedConsumptionKwh: Number(Number(deviceSummary.rows[0]?.estimated_consumption_kwh || 0).toFixed(2)), consumptionAssumedHours: 4, estimatedWasteKwh: Number(wasteKwh.toFixed(3)), estimatedPotentialSavingsInr: Number(wasteCost.toFixed(2)), activeAlerts: openAlerts.length, devicesOn: Number(deviceSummary.rows[0]?.devices_on || 0) }, rooms: rooms.rows, alerts: alerts.rows });
  } catch (error) { console.error('dashboard query failed', error?.message); res.status(500).json({ error: 'Could not load monitoring data.' }); }
}
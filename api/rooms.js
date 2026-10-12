import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (req, res) {
  const category = typeof req.query?.category === 'string' ? req.query.category : null;
  const allowed = ['Laboratory','Classroom','Server Room'];
  if (category && !allowed.includes(category)) return res.status(400).json({ error: 'Invalid room category.' });
  try {
    const result = category
      ? await db.query("SELECT r.*, COALESCE(o.occupancy_status,'unknown') AS occupancy_status, o.observed_at AS occupancy_observed_at, COALESCE(o.source,'simulated') AS occupancy_source FROM rooms r LEFT JOIN LATERAL (SELECT occupancy_status, observed_at, source FROM observations WHERE room_id=r.id ORDER BY observed_at DESC LIMIT 1) o ON TRUE WHERE r.category=$1 ORDER BY r.name", [category])
      : await db.query("SELECT r.*, COALESCE(o.occupancy_status,'unknown') AS occupancy_status, o.observed_at AS occupancy_observed_at, COALESCE(o.source,'simulated') AS occupancy_source FROM rooms r LEFT JOIN LATERAL (SELECT occupancy_status, observed_at, source FROM observations WHERE room_id=r.id ORDER BY observed_at DESC LIMIT 1) o ON TRUE ORDER BY r.category,r.name");
    res.json({ rooms: result.rows });
  } catch (error) { console.error('rooms query failed', error?.message); res.status(500).json({ error: 'Could not load rooms.' }); }
}
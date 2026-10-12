import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function (req, res) {
  try {
    const status = typeof req.query?.status === 'string' ? req.query.status : null;
    const allowed = ['open','verified','resolved','dismissed'];
    if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid alert status.' });
    const result = status
      ? await db.query("SELECT a.id,a.room_id,r.name AS room_name,r.category,d.name AS device_name,a.severity,a.status,a.title,a.description,a.estimated_kwh,a.estimated_cost,a.recommendation,a.verification_status,a.observed_at,a.created_at FROM alerts a JOIN rooms r ON r.id=a.room_id LEFT JOIN devices d ON d.id=a.device_id WHERE a.status=$1 ORDER BY a.created_at DESC", [status])
      : await db.query("SELECT a.id,a.room_id,r.name AS room_name,r.category,d.name AS device_name,a.severity,a.status,a.title,a.description,a.estimated_kwh,a.estimated_cost,a.recommendation,a.verification_status,a.observed_at,a.created_at FROM alerts a JOIN rooms r ON r.id=a.room_id LEFT JOIN devices d ON d.id=a.device_id ORDER BY a.created_at DESC");
    res.json({ alerts: result.rows });
  } catch (error) { console.error('alerts query failed', error?.message); res.status(500).json({ error: 'Could not load alerts.' }); }
}
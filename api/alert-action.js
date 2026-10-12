import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const body = req.body || {};
  const alertId = typeof body.alertId === 'string' ? body.alertId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0,1000) : '';
  if (!alertId || !['verify','resolve','dismiss'].includes(action)) return res.status(400).json({ error: 'Provide a valid alertId and action.' });
  const status = action === 'verify' ? 'verified' : action === 'resolve' ? 'resolved' : 'dismissed';
  try {
    const result = await db.query("UPDATE alerts SET status=$1, verification_status=$2, resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN NOW() ELSE resolved_at END WHERE id=$3 RETURNING id,status,verification_status,resolved_at", [status, action === 'verify' ? 'verified by operator' : action === 'resolve' ? 'resolved by operator' : 'dismissed by operator', alertId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Alert not found.' });
    await db.query("INSERT INTO action_history (id,alert_id,action,actor_label,notes) VALUES ($1,$2,$3,$4,$5)", [crypto.randomUUID(), alertId, action, req.member?.display_name || req.member?.handle || 'Campus operator', notes]);
    res.json({ alert: result.rows[0], message: 'Alert updated.' });
  } catch (error) { console.error('alert action failed', error?.message); res.status(500).json({ error: 'Could not update the alert.' }); }
}
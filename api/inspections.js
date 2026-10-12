import { db } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function (req, res) {
  const body = req.body || {};
  const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
  const occupancy = body.occupancyStatus;
  const outcome = body.outcome;
  const deviceNotes = typeof body.deviceNotes === 'string' ? body.deviceNotes.trim().slice(0,2000) : '';
  if (!roomId || !['occupied','unoccupied','unknown'].includes(occupancy) || !['no_issue','device_switched_off','alert_verified','follow_up_required'].includes(outcome) || !deviceNotes) return res.status(400).json({ error: 'Complete the room, occupancy, inspection notes, and outcome fields.' });
  try {
    const room = await db.query('SELECT id FROM rooms WHERE id=$1', [roomId]);
    if (!room.rows.length) return res.status(404).json({ error: 'Room not found.' });
    const id = crypto.randomUUID();
    await db.query('INSERT INTO inspections (id,room_id,inspector_label,occupancy_status,device_notes,outcome) VALUES ($1,$2,$3,$4,$5,$6)', [id, roomId, req.member?.display_name || req.member?.handle || 'Campus operator', occupancy, deviceNotes, outcome]);
    await db.query('INSERT INTO observations (id,room_id,occupancy_status,observed_at,source,notes) VALUES ($1,$2,$3,NOW(),$4,$5)', [crypto.randomUUID(), roomId, occupancy, 'manual', 'Manual inspection: ' + deviceNotes]);
    res.status(201).json({ inspection: { id, roomId, occupancyStatus: occupancy, outcome }, message: 'Inspection saved.' });
  } catch (error) { console.error('inspection save failed', error?.message); res.status(500).json({ error: 'Could not save the inspection.' }); }
}
export const ensureBus = (db, id) => db.query('INSERT INTO buses (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
const BUS = `SELECT b.id AS bus_id, b.name, b.is_active, b.created_at,
  (SELECT count(*)::int FROM observations o WHERE o.bus_id = b.id) AS observation_count,
  (SELECT max(o.detected_at) FROM observations o WHERE o.bus_id = b.id) AS last_observation_at FROM buses b`;
export async function listBuses(db) { return (await db.query(`${BUS} ORDER BY b.id`)).rows; }
export async function getBus(db, id) {
  const bus = (await db.query(`${BUS} WHERE b.id = $1`, [id])).rows[0];
  if (!bus) return null;
  bus.recent_observations = (await db.query(
    `SELECT id::int AS id, 'INC' || LPAD(incident_id::text, 6, '0') AS incident_id, event_type, latitude, longitude, detected_at, confidence
     FROM observations WHERE bus_id = $1 ORDER BY detected_at DESC LIMIT 20`, [id])).rows;
  return bus;
}

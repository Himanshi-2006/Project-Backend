// All incident SQL. Values are always passed as $n parameters (no SQL injection).
export const COLS = `'INC' || LPAD(i.id::text, 6, '0') AS id, i.event_type, i.latitude, i.longitude,
  i.first_observed_at AS timestamp, i.last_observed_at, i.confidence, i.status, i.observation_count, i.created_at, i.updated_at,
  (SELECT o.bus_id FROM observations o WHERE o.incident_id = i.id ORDER BY o.detected_at, o.id LIMIT 1) AS bus_id,
  (SELECT (o.metadata->>'vehicle_count')::int FROM observations o WHERE o.incident_id = i.id AND o.metadata->>'vehicle_count' IS NOT NULL
     ORDER BY o.detected_at DESC LIMIT 1) AS vehicle_count`;
const PT = (lon, lat) => `ST_SetSRID(ST_MakePoint($${lon}, $${lat}), 4326)::geography`;

export const parseId = (s) => { const m = /^INC(\d{1,18})$/.exec(s); return m ? Number(m[1]) : null; };

export async function findMatch(db, d, rule) {
  const { rows } = await db.query(
    `SELECT id, observation_count, confidence FROM incidents
     WHERE event_type = $1 AND status IN ('open','investigating')
       AND ST_DWithin(location, ${PT(2, 3)}, $4)
       AND last_observed_at  >= $5::timestamptz - make_interval(mins => $6::int)
       AND first_observed_at <= $5::timestamptz + make_interval(mins => $6::int)
     ORDER BY ST_Distance(location, ${PT(2, 3)}) LIMIT 1 FOR UPDATE`,
    [d.event_type, d.longitude, d.latitude, rule.distanceM, d.timestamp, rule.windowMinutes]);
  return rows[0] || null;
}
export async function insertIncident(db, d) {
  const { rows } = await db.query(
    `INSERT INTO incidents (event_type, latitude, longitude, location, first_observed_at, last_observed_at, confidence)
     VALUES ($1, $2, $3, ${PT(3, 2)}, $4, $4, $5) RETURNING id`,
    [d.event_type, d.latitude, d.longitude, d.timestamp, d.confidence]);
  return Number(rows[0].id);
}
export const updateIncident = (db, id, ts, confidence) => db.query(
  `UPDATE incidents SET observation_count = observation_count + 1, confidence = $2,
     first_observed_at = LEAST(first_observed_at, $3::timestamptz), last_observed_at = GREATEST(last_observed_at, $3::timestamptz), updated_at = now()
   WHERE id = $1`, [id, confidence, ts]);
export async function insertObservation(db, incidentId, d, metadata) {
  const { rows } = await db.query(
    `INSERT INTO observations (incident_id, bus_id, event_type, latitude, longitude, location, detected_at, confidence, metadata)
     VALUES ($1, $2, $3, $4, $5, ${PT(5, 4)}, $6, $7, $8::jsonb) RETURNING id`,
    [incidentId, d.bus_id, d.event_type, d.latitude, d.longitude, d.timestamp, d.confidence, JSON.stringify(metadata)]);
  return Number(rows[0].id);
}
export async function getById(db, pk) {
  const { rows } = await db.query(`SELECT ${COLS} FROM incidents i WHERE i.id = $1`, [pk]);
  return rows[0] || null;
}
export async function getObservations(db, pk) {
  const { rows } = await db.query(
    `SELECT id::int AS id, bus_id, detected_at, latitude, longitude, confidence, metadata FROM observations WHERE incident_id = $1 ORDER BY detected_at, id`, [pk]);
  return rows;
}
export async function list(db, f) {
  const w = [], p = [];
  const add = (sql, v) => { p.push(v); w.push(sql.replace('?', `$${p.length}`)); };
  if (f.event_type) add('i.event_type = ?', f.event_type);
  if (f.status) add('i.status = ?', f.status);
  if (f.bus_id) add('EXISTS (SELECT 1 FROM observations o WHERE o.incident_id = i.id AND o.bus_id = ?)', f.bus_id);
  if (f.from) add('i.first_observed_at >= ?::timestamptz', f.from);
  if (f.to) add('i.first_observed_at <= ?::timestamptz', f.to);
  if (f.bbox) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox;
    add('i.longitude >= ?', minLng); add('i.latitude >= ?', minLat); add('i.longitude <= ?', maxLng); add('i.latitude <= ?', maxLat);
  }
  const where = w.length ? ` WHERE ${w.join(' AND ')}` : '';
  const total = (await db.query(`SELECT count(*)::int AS n FROM incidents i${where}`, p)).rows[0].n;
  const rows = (await db.query(
    `SELECT ${COLS} FROM incidents i${where} ORDER BY i.first_observed_at DESC, i.id DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
    [...p, f.limit, f.offset])).rows;
  return { rows, total };
}
export async function nearby(db, q) {
  const p = [q.longitude, q.latitude, q.radius_m, q.limit];
  let extra = '';
  if (q.event_type) { p.push(q.event_type); extra = ' AND i.event_type = $5'; }
  const { rows } = await db.query(
    `SELECT ${COLS}, ST_Distance(i.location, ${PT(1, 2)})::float8 AS distance_m FROM incidents i
     WHERE ST_DWithin(i.location, ${PT(1, 2)}, $3)${extra} ORDER BY distance_m LIMIT $4`, p);
  return rows;
}
export async function setStatus(db, pk, status) {
  const r = await db.query('UPDATE incidents SET status = $2, updated_at = now() WHERE id = $1', [pk, status]);
  return r.rowCount > 0;
}

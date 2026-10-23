export async function summary(db) {
  const c = (await db.query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE status='open')::int AS open, count(*) FILTER (WHERE status='investigating')::int AS investigating,
    count(*) FILTER (WHERE status='resolved')::int AS resolved, count(*) FILTER (WHERE status='false_positive')::int AS false_positive FROM incidents`)).rows[0];
  const t = (await db.query('SELECT event_type, count(*)::int AS n FROM incidents GROUP BY 1')).rows;
  return { total_incidents: c.total, open_incidents: c.open, investigating_incidents: c.investigating, resolved_incidents: c.resolved,
    false_positive_incidents: c.false_positive, by_type: Object.fromEntries(t.map((r) => [r.event_type, r.n])) };
}
function range(col, { from, to }, p) {
  const w = [];
  if (from) { p.push(from); w.push(`${col} >= $${p.length}::timestamptz`); }
  if (to) { p.push(to); w.push(`${col} <= $${p.length}::timestamptz`); }
  return w.length ? ` AND ${w.join(' AND ')}` : '';
}
export async function traffic(db, r) {
  const p1 = [], p2 = [];
  const incidents = (await db.query(`SELECT to_char(first_observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*)::int AS count
    FROM incidents WHERE TRUE${range('first_observed_at', r, p1)} GROUP BY 1 ORDER BY 1`, p1)).rows;
  const congestion = (await db.query(`SELECT to_char(detected_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, count(*)::int AS observations,
    COALESCE(SUM((metadata->>'vehicle_count')::int), 0)::int AS vehicle_count, count(metadata->>'vehicle_count')::int AS observations_with_vehicle_count
    FROM observations WHERE event_type = 'congestion'${range('detected_at', r, p2)} GROUP BY 1 ORDER BY 1`, p2)).rows;
  return { incidents_by_day: incidents, congestion_by_day: congestion,
    note: 'Calculated only from stored observations. vehicle_count exists only if the AI module sent it.' };
}
export async function hotspots(db, { min_incidents, event_type }) {
  const p = [min_incidents]; let extra = '';
  if (event_type) { p.push(event_type); extra = 'WHERE event_type = $2'; }
  const { rows } = await db.query(`SELECT (ROUND(latitude::numeric / 0.005) * 0.005)::float8 AS latitude, (ROUND(longitude::numeric / 0.005) * 0.005)::float8 AS longitude,
    count(*)::int AS incident_count, sum(observation_count)::int AS observation_count, array_agg(DISTINCT event_type) AS event_types
    FROM incidents ${extra} GROUP BY 1, 2 HAVING count(*) >= $1 ORDER BY incident_count DESC LIMIT 100`, p);
  return rows;
}

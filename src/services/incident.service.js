import { withTransaction, getPool } from '../db/pool.js';
import { fusionRules } from '../config/fusionRules.js';
import * as repo from '../repositories/incident.repository.js';
import { ensureBus } from '../repositories/bus.repository.js';
import { ApiError } from '../middleware/errorHandler.js';

// Confidence rule: running mean of all observation confidences for the incident.
export const mergedConfidence = (old, count, next) => (old * count + next) / (count + 1);

/** Fusion: decide whether a detection belongs to an existing incident, all inside ONE transaction. */
export function ingestDetection(d) {
  return withTransaction(async (c) => {
    // Serialise writers of the same event type so two buses reporting the same pothole at once cannot both create it.
    // The lock is released automatically at COMMIT/ROLLBACK. Trade-off: same-type writes queue up (fine at prototype scale).
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [d.event_type]);
    await ensureBus(c, d.bus_id); // unknown buses are auto-registered
    const match = await repo.findMatch(c, d, fusionRules[d.event_type]);
    let incidentId, created;
    if (match) {
      created = false; incidentId = Number(match.id);
      await repo.updateIncident(c, incidentId, d.timestamp, mergedConfidence(match.confidence, match.observation_count, d.confidence));
    } else {
      created = true; incidentId = await repo.insertIncident(c, d);
    }
    const metadata = { ...(d.metadata || {}), ...(d.vehicle_count != null ? { vehicle_count: d.vehicle_count } : {}) };
    const observationId = await repo.insertObservation(c, incidentId, d, metadata);
    const incident = await repo.getById(c, incidentId);
    return { incident_id: incident.id, observation_id: observationId, created, incident };
  });
}
export async function getIncident(id) {
  const pk = repo.parseId(id);
  const incident = pk && await repo.getById(getPool(), pk);
  if (!incident) throw new ApiError(404, 'not_found', 'Incident not found');
  return { ...incident, observations: await repo.getObservations(getPool(), pk) };
}
export async function updateStatus(id, status) {
  const pk = repo.parseId(id);
  if (!pk || !(await repo.setStatus(getPool(), pk, status))) throw new ApiError(404, 'not_found', 'Incident not found');
  return repo.getById(getPool(), pk);
}
export async function listIncidents(f) {
  const { rows, total } = await repo.list(getPool(), f);
  return { incidents: rows, total, limit: f.limit, offset: f.offset };
}
export async function nearbyIncidents(q) {
  const rows = await repo.nearby(getPool(), q);
  return { incidents: rows, count: rows.length, radius_m: q.radius_m };
}

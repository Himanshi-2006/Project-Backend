import { z } from 'zod';

export const EVENT_TYPES = ['pothole', 'road_damage', 'accident', 'signboard', 'traffic_light', 'congestion'];
export const STATUSES = ['open', 'investigating', 'resolved', 'false_positive'];

const busId = z.string().regex(/^[A-Za-z0-9_-]{1,50}$/, 'bus_id may only contain letters, digits, _ and -');
// Requires a timezone (Z or +hh:mm); timezone-less timestamps are rejected.
const ts = z.string().datetime({ offset: true, message: 'Must be ISO-8601 with a timezone, e.g. 2026-10-14T10:00:00Z' });

export const detectionBody = z.object({
  event_type: z.enum(EVENT_TYPES),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: ts.transform((s) => new Date(s).toISOString()), // normalised to UTC
  bus_id: busId,
  confidence: z.number().min(0).max(1),
  vehicle_count: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional(),
});

export const patchBody = z.object({ status: z.enum(STATUSES) }).strict();
export const idParams = z.object({ id: z.string().regex(/^INC\d{1,18}$/, 'Incident id looks like INC000001') });
export const busParams = z.object({ id: busId });

const bbox = z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, 'bbox must be minLng,minLat,maxLng,maxLat').transform((s) => s.split(',').map(Number));
export const listQuery = z.object({
  event_type: z.enum(EVENT_TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  bus_id: busId.optional(),
  from: ts.optional(),
  to: ts.optional(),
  bbox: bbox.optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});
export const nearbyQuery = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().positive().max(5000).default(100),
  event_type: z.enum(EVENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const rangeQuery = z.object({ from: ts.optional(), to: ts.optional() });
export const hotspotQuery = z.object({
  min_incidents: z.coerce.number().int().min(1).max(1000).default(3),
  event_type: z.enum(EVENT_TYPES).optional(),
});

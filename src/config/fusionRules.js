// Matching rules per event type. Change these to tune duplicate detection.
// A new detection joins an existing incident only if: same type, status is open/investigating,
// within distanceM metres, and within windowMinutes of the incident's observed period.
import { env } from './env.js';

const persistent = { distanceM: env.MATCH_DISTANCE_M, windowMinutes: 30 * 24 * 60 }; // defects stay until repaired
export const fusionRules = {
  pothole: persistent,
  road_damage: persistent,
  signboard: persistent,
  traffic_light: persistent,
  accident: { distanceM: env.MATCH_DISTANCE_M, windowMinutes: 30 },  // short window: two crashes at one junction are usually separate
  congestion: { distanceM: Math.max(env.MATCH_DISTANCE_M, 100), windowMinutes: 15 }, // congestion spans a stretch of road
};

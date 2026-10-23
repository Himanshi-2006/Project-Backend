import { getPool } from '../db/pool.js';
import * as repo from '../repositories/analytics.repository.js';
export const summary = () => repo.summary(getPool());
export const traffic = (range) => repo.traffic(getPool(), range);
export const hotspots = async (q) => ({ hotspots: await repo.hotspots(getPool(), q), cell_size_degrees: 0.005 });

import { getPool } from '../db/pool.js';
import * as repo from '../repositories/bus.repository.js';
import { ApiError } from '../middleware/errorHandler.js';
export async function list() { const buses = await repo.listBuses(getPool()); return { buses, count: buses.length }; }
export async function get(id) {
  const bus = await repo.getBus(getPool(), id);
  if (!bus) throw new ApiError(404, 'not_found', 'Bus not found');
  return bus;
}

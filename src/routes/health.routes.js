import { Router } from 'express';
import { query } from '../db/pool.js';
const r = Router();
r.get('/', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok', database: 'up' }); }
  catch { res.status(503).json({ status: 'degraded', database: 'down' }); }
});
export default r;

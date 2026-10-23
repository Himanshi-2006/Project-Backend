import app from './app.js';
import { env } from './config/env.js';
import { getPool, query } from './db/pool.js';

const server = app.listen(env.PORT, async () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
  try { await query('SELECT 1'); console.log('Database connection OK'); }
  catch (e) { console.error('WARNING: database not reachable. Is `docker compose up -d` running?', e.code || e.message); }
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => { await getPool().end().catch(() => {}); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

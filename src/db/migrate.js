// Applies src/db/migrations/*.sql in name order, once each.  Run: npm run migrate
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if ((await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [f])).rowCount) continue;
    const sql = await fs.readFile(path.join(dir, f), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await c.query('COMMIT');
      console.log('Applied migration', f);
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { getPool } = await import('./pool.js');
  try { await migrate(getPool()); console.log('Migrations up to date.'); }
  catch (e) { console.error('Migration failed:', e.message); process.exitCode = 1; }
  finally { await getPool().end(); }
}

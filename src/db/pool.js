// One shared connection pool. All SQL goes through here.
import pg from 'pg';
import { env } from '../config/env.js';

let pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, connectionTimeoutMillis: 3000 });
pool.on('error', (e) => console.error('Idle DB client error:', e.message));

export const getPool = () => pool;
export const setPool = (p) => { pool = p; }; // used by tests to simulate a database outage
export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

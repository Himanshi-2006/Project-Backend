import 'dotenv/config';

// Boots the app against the TEST database only. Refuses any database not named *_test.
export async function bootstrap() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Set TEST_DATABASE_URL in .env (see .env.example)');
  if (!/_test$/.test(new URL(url).pathname.slice(1))) throw new Error('TEST_DATABASE_URL must point to a database named *_test');
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  const db = await import('../src/db/pool.js');
  const { migrate } = await import('../src/db/migrate.js');
  const { default: app } = await import('../src/app.js');
  await migrate(db.getPool());
  return { app, db };
}
export const reset = (db) => db.query('TRUNCATE observations, incidents, buses RESTART IDENTITY CASCADE');
export const det = (o = {}) => ({ event_type: 'pothole', latitude: 30.7333, longitude: 76.7794, timestamp: '2026-10-14T10:00:00Z', bus_id: 'BUS_101', confidence: 0.9, ...o });

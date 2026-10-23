// Loads .env and validates it once at startup. The app refuses to start with bad settings.
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  MATCH_DISTANCE_M: z.coerce.number().positive().default(30),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
export const env = { ...parsed.data, FRONTEND_ORIGINS: parsed.data.FRONTEND_ORIGIN.split(',').map((s) => s.trim()) };

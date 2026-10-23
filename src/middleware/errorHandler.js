import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const body = (code, message, details = []) => ({ error: { code, message, details } });
const isDbDown = (e) => ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(e.code) || /^(08|53|57)/.test(String(e.code)) ||
  e.name === 'AggregateError' || /timeout exceeded when trying to connect|Connection terminated/i.test(e.message || '');

export const notFound = (req, res) => res.status(404).json(body('not_found', `Route ${req.method} ${req.path} not found`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(422).json(body('validation_error', 'Request validation failed', details));
  }
  if (err instanceof ApiError) return res.status(err.status).json(body(err.code, err.message));
  if (err.type === 'entity.parse.failed') return res.status(400).json(body('invalid_json', 'Request body is not valid JSON'));
  if (isDbDown(err)) {
    console.error(`Database unavailable on ${req.path}: ${err.code || err.name}`); // never log the connection string
    return res.status(503).json(body('database_unavailable', 'The database is currently unavailable'));
  }
  console.error(`Unhandled error on ${req.path}:`, err.message);
  return res.status(500).json(body('internal_error', 'Internal server error'));
}

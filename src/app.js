import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import health from './routes/health.routes.js';
import incidents from './routes/incident.routes.js';
import analytics from './routes/analytics.routes.js';
import buses from './routes/bus.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGINS, methods: ['GET', 'POST', 'PATCH'] })); // only the dashboard origin(s)
app.use(express.json({ limit: '100kb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api/health', health);
app.use('/api/incidents', incidents);
app.use('/api/analytics', analytics);
app.use('/api/buses', buses);
app.use(notFound);
app.use(errorHandler);
export default app;

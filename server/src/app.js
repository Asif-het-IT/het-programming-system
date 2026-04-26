import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import monitoringRoutes from './routes/monitoring.js';

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(globalLimiter);

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', dataRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/monitoring', monitoringRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env.js';
import { globalLimiter, adminReadLimiter, adminWriteLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import monitoringRoutes from './routes/monitoring.js';
import alertsRoutes from './routes/alerts.js';
import { reportPerformanceEvent } from './services/alertService.js';

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(globalLimiter);
app.use('/api/admin', (req, res, next) => {
	const method = String(req.method || '').toUpperCase();
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
		return adminReadLimiter(req, res, next);
	}
	return adminWriteLimiter(req, res, next);
});

app.use('/api', (req, res, next) => {
	const startedAt = Date.now();
	res.on('finish', () => {
		const durationMs = Date.now() - startedAt;
		if (durationMs < 3000) return;
		// Exclude internal retry-sync and alert management paths from performance monitoring
		if (req.path.includes('retry-sync') || req.path.includes('/alerts/')) return;
		void reportPerformanceEvent({
			database: String(req.query?.database || req.body?.database || '').toUpperCase() || null,
			view: req.query?.view || req.body?.view || null,
			api: req.path,
			layer: 'api',
			durationMs,
			rowCount: null,
			cacheHit: false,
		});
	});
	return next();
});

app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', dataRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', alertsRoutes);
app.use('/api/admin/monitoring', monitoringRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

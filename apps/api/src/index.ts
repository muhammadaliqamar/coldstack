import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initSocket } from './socket';

// Route imports
import authRoutes from './routes/auth';
import domainRoutes from './routes/domains';
import inboxRoutes from './routes/inboxes';
import listRoutes from './routes/lists';
import campaignRoutes from './routes/campaigns';
import leadRoutes from './routes/leads';
import analyticsRoutes from './routes/analytics';
import trackingRoutes from './routes/tracking';
import templatesRoutes from './routes/templates';
import seedRoutes from './routes/seeds';
import deliverabilityRoutes from './routes/deliverability';

const app = express();
const httpServer = createServer(app);

// ─── Middleware ──────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 100 requests/min per user
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// ─── Routes ─────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/inboxes', inboxRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/seeds', seedRoutes);
app.use('/api/deliverability', deliverabilityRoutes);

// Tracking routes (no /api prefix — short URLs)
app.use('/t', trackingRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ──────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ─── Socket.io ──────────────────────────────────────────

initSocket(httpServer);

// ─── Start Server ───────────────────────────────────────

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 ColdStack API running on port ${PORT}`);
});

export default app;

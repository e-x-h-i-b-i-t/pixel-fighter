import express      from 'express';
import cors         from 'cors';
import rateLimit    from 'express-rate-limit';
import { router as qtableRouter } from './routes/qtable.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────

// Allow requests from the game client (any origin in dev; lock down in prod)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, etc.) or matching origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  }
}));

// Parse JSON bodies — Q-table is ~72 KB max
app.use(express.json({ limit: '512kb' }));

// Rate limiting on contribution endpoint: max 30 uploads per IP per minute
// (A player can finish at most ~1 match per minute)
const contributeLimiter = rateLimit({
  windowMs:         60_000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many contributions from this IP, please slow down.' }
});
app.use('/api/ai/contribute', contributeLimiter);

// General API rate limit: 120 req/min per IP
const generalLimiter = rateLimit({
  windowMs:         60_000,
  max:              120,
  standardHeaders:  true,
  legacyHeaders:    false
});
app.use('/api', generalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/ai', qtableRouter);

// Health check — used by Docker, Railway, Render uptime monitoring
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🧠 RL API server running → http://localhost:${PORT}`);
  console.log(`   Health:     GET  /health`);
  console.log(`   Q-table:    GET  /api/ai/qtable`);
  console.log(`   Contribute: POST /api/ai/contribute`);
  console.log(`   Stats:      GET  /api/ai/stats`);
});

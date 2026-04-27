require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const crypto = require('crypto');

const routes = require('./routes');
const { initializeSocket } = require('./socket');
const { checkStaleTrips } = require('./controllers/tripController');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Middleware
app.use(helmet());
app.use(compression());

const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:55054', 'http://localhost:55055', 'http://localhost:55056'];
app.use(cors({ origin: true, credentials: true })); // Allow all origins in development
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Routes
app.use('/api/v1', routes);

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${req.requestId}]`, err.stack);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(500).json({ error: message, requestId: req.requestId });
});

// Background jobs
setInterval(checkStaleTrips, 30 * 60 * 1000); // every 30 min

// Location log cleanup (daily)
const cleanupOldLogs = async () => {
  const pool = require('./config/database');
  const days = parseInt(process.env.LOG_RETENTION_DAYS || '90');
  try {
    const result = await pool.query(
      `DELETE FROM location_logs WHERE timestamp < NOW() - INTERVAL '${days} days'`
    );
    if (result.rowCount > 0) console.log(`Cleaned up ${result.rowCount} old location logs`);
  } catch (err) {
    console.error('Log cleanup error:', err.message);
  }
};
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 5001;

// Startup DB + Redis check
async function startServer() {
  const pool = require('./config/database');
  const redisClient = require('./config/redis');

  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 10000)),
    ]);
    console.log('✓ PostgreSQL connection verified');
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err.message);
    process.exit(1);
  }

  try {
    await Promise.race([
      redisClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 10000)),
    ]);
    console.log('✓ Redis connection verified');
  } catch (err) {
    console.warn('⚠ Redis not available:', err.message);
    console.warn('⚠ Running without Redis — live location caching disabled');
    // Don't exit — allow server to run without Redis in development
  }

  server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚌 Trackify Production Backend`);
    console.log(`✓  http://localhost:${PORT}/api/v1`);
    console.log(`✓  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================================\n`);
  });
}

startServer();

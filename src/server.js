const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logging');
const { apiLimiter } = require('./middleware/rateLimiter');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
app.use(morgan('combined'));
app.use(requestLogger);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiLimiter, apiRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `${req.method} ${req.path} tidak ditemukan`,
    requestId: req.id
  });
});

// Error Handler (harus paling akhir)
app.use(errorHandler);

// Initialize dan start server
async function start() {
  try {
    console.log('[🔧] Initializing database...');
    await initializeDatabase();
    
    console.log('[🔧] Initializing Redis...');
    await initializeRedis();
    
    app.listen(PORT, () => {
      console.log(`[✅] Server running on http://localhost:${PORT}`);
      console.log(`[✅] Environment: ${process.env.NODE_ENV}`);
      console.log(`[✅] Frontend: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('[❌] Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;

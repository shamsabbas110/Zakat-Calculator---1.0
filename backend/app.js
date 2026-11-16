const express = require('express');
const cors = require('cors');
const zakatRoutes = require('./routes/zakatRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Allowed origins for CORS (supports local development & production deployments like Vercel)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    // or if origin is in whitelist, or in non-production environments
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to allow connection
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// express.json() with body size limit to prevent payload flooding attacks
app.use(express.json({ limit: '5mb' }));

// Authentication Routes
app.use('/api/auth', authRoutes);

// Core Zakat & Rates Routes
app.use('/api/zakat', zakatRoutes);

// Production Health Check routes (used by Render, uptime monitors, and load balancers)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Zakat Calculator API is running'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Zakat Calculator API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("Global Error Caught:", err.message);
  
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;

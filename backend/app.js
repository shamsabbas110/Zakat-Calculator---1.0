const express = require('express');
const cors = require('cors');
const zakatRoutes = require('./routes/zakatRoutes');

const app = express();

// Middleware
// cors() allows the frontend to communicate with this backend API
// Specifically configured for local React development
app.use(cors({
  origin: '*', // Allow all origins so Vercel can connect
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  credentials: true
}));

// express.json() allows the server to read incoming JSON data in the request body
app.use(express.json());

// Routes
// All routes starting with /api/zakat will be handled by zakatRoutes
app.use('/api/zakat', zakatRoutes);

// Simple health check route
app.get('/', (req, res) => {
  res.send('Zakat Calculator API is running...');
});

// Global Error Handler
// Catches any errors thrown in routes/controllers and prevents server crashes
app.use((err, req, res, next) => {
  console.error("Global Error Caught:", err.message);
  
  // Return a clean 400 or 500 JSON error
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;

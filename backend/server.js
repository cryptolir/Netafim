/*
 * Main server entry point for the Netafim backend.
 *
 * This Express application exposes REST endpoints for authentication,
 * orders/deals retrieval from SAP, integration with Searates APIs,
 * and a chat assistant endpoint.  Most handlers delegate to modules
 * under the `routes` and `services` directories.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file (if present)
dotenv.config();

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// Custom middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health check (must be registered BEFORE auth-protected routes) ──────────
// Railway pings this path to determine if the deployment is healthy.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route modules
const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const searatesRoutes = require('./routes/searates');
const chatRoutes = require('./routes/chat');

// Register routes under /api
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/containers', searatesRoutes);
app.use('/api/chat', chatRoutes);

// Serve the React frontend build
const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuild));

// Catch-all: serve React app for any non-API route (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// Global error handler — prevents unhandled errors from crashing the process
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack || err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const port = process.env.PORT || 4000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Netafim backend server listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: /api/health`);
});

// Graceful shutdown — required for Railway to restart cleanly
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

// Catch unhandled promise rejections to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

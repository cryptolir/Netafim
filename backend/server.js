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

// Custom middleware to log requests (replace with proper logging)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the React frontend build
const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuild));

// Catch-all: serve React app for any non-API route (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuild, 'index.html'));
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Netafim backend server listening on port ${port}`);
});
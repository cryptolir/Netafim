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

// Catch‑all route for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Netafim backend server listening on port ${port}`);
});
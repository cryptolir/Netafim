const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { trackContainer, getSchedules } = require('../services/searatesService');

const router = express.Router();

/**
 * GET /api/containers/track/:number
 * Track a container by container number, B/L, or booking reference.
 */
router.get('/track/:number', authenticateToken, async (req, res) => {
  const { number } = req.params;
  const { type } = req.query;
  try {
    const data = await trackContainer(number, type || null);
    return res.json(data);
  } catch (err) {
    console.error('Tracking error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch container tracking information', details: err.message });
  }
});

/**
 * GET /api/containers/schedules
 * Fetch vessel schedules between two ports.
 * Query params: origin, destination, from_date, weeks, cargo_type, direct_only
 */
router.get('/schedules', authenticateToken, async (req, res) => {
  const { origin, destination, from_date, weeks, cargo_type, direct_only } = req.query;
  try {
    const data = await getSchedules(origin, destination, from_date, {
      weeks: weeks ? parseInt(weeks) : 4,
      cargoType: cargo_type || 'GC',
      directOnly: direct_only === 'true'
    });
    return res.json(data);
  } catch (err) {
    console.error('Schedules error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch schedules', details: err.message });
  }
});

// Legacy route support
router.get('/:containerId', authenticateToken, async (req, res) => {
  const { containerId } = req.params;
  try {
    const data = await trackContainer(containerId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch container tracking information' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  const { portFrom, portTo, date } = req.query;
  try {
    const data = await getSchedules(portFrom, portTo, date);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

module.exports = router;

const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { trackContainer, getSchedules } = require('../services/searatesService');

const router = express.Router();

/**
 * GET /api/containers/:containerId
 * Fetch container tracking data from Searates.
 */
router.get('/:containerId', authenticateToken, async (req, res) => {
  const { containerId } = req.params;
  try {
    const data = await trackContainer(containerId);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch container tracking information' });
  }
});

/**
 * GET /api/containers/schedules
 * Fetch vessel schedules from Searates.  Accepts optional query parameters
 * such as `portFrom`, `portTo`, and `date`.
 */
router.get('/', authenticateToken, async (req, res) => {
  const { portFrom, portTo, date } = req.query;
  try {
    const data = await getSchedules(portFrom, portTo, date);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

module.exports = router;
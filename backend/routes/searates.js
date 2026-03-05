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

/**
 * GET /api/containers/ports
 * Returns coordinates for Netafim's common ports for map display.
 */
router.get('/ports', authenticateToken, async (req, res) => {
  const NETAFIM_PORTS = [
    { code: 'ILASH', name: 'Ashdod', country: 'Israel', lat: 31.8167, lng: 34.6333 },
    { code: 'ILHFA', name: 'Haifa', country: 'Israel', lat: 32.8192, lng: 34.9983 },
    { code: 'DEHAM', name: 'Hamburg', country: 'Germany', lat: 53.5461, lng: 9.9663 },
    { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', lat: 51.9225, lng: 4.4792 },
    { code: 'BEANR', name: 'Antwerp', country: 'Belgium', lat: 51.2194, lng: 4.4025 },
    { code: 'FRFOS', name: 'Fos-sur-Mer', country: 'France', lat: 43.4375, lng: 4.9444 },
    { code: 'ESVLC', name: 'Valencia', country: 'Spain', lat: 39.4561, lng: -0.3311 },
    { code: 'CNSHA', name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
    { code: 'USLAX', name: 'Los Angeles', country: 'USA', lat: 33.7395, lng: -118.2596 },
    { code: 'AEJEA', name: 'Jebel Ali', country: 'UAE', lat: 24.9857, lng: 55.0272 },
    { code: 'SGSIN', name: 'Singapore', country: 'Singapore', lat: 1.2897, lng: 103.8501 },
    { code: 'GBFXT', name: 'Felixstowe', country: 'UK', lat: 51.9553, lng: 1.3516 },
    { code: 'TRIST', name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
    { code: 'EGPSD', name: 'Port Said', country: 'Egypt', lat: 31.2565, lng: 32.2841 },
  ];
  return res.json({ ports: NETAFIM_PORTS });
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

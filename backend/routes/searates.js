const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { trackContainer, trackAirShipment, getSchedules, getFlightSchedules } = require('../services/searatesService');

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
 * GET /api/containers/air/track/:awb
 * Track an air shipment by Air Waybill (AWB) number.
 * Example: /api/containers/air/track/020-17363006
 */
router.get('/air/track/:awb', authenticateToken, async (req, res) => {
  const { awb } = req.params;
  try {
    const data = await trackAirShipment(awb);
    return res.json(data);
  } catch (err) {
    console.error('Air tracking error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch air shipment tracking information', details: err.message });
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
 * GET /api/containers/air/schedules
 * Fetch flight schedules between two airports.
 * Query params: origin, destination, departure_date, direct_only, airlines_codes
 */
router.get('/air/schedules', authenticateToken, async (req, res) => {
  const { origin, destination, departure_date, direct_only, airlines_codes } = req.query;
  try {
    const data = await getFlightSchedules(origin, destination, departure_date, {
      directOnly: direct_only === 'true',
      airlinesCodes: airlines_codes || null
    });
    return res.json(data);
  } catch (err) {
    console.error('Flight schedules error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch flight schedules', details: err.message });
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

/**
 * GET /api/containers/airports
 * Returns coordinates for Netafim's common airports for map display.
 */
router.get('/airports', authenticateToken, async (req, res) => {
  const NETAFIM_AIRPORTS = [
    { code: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', lat: 32.0114, lng: 34.8867 },
    { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lng: 2.5479 },
    { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lng: 8.5622 },
    { code: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lng: 4.7683 },
    { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'UK', lat: 51.4775, lng: -0.4614 },
    { code: 'JFK', name: 'John F. Kennedy Airport', city: 'New York', country: 'USA', lat: 40.6413, lng: -73.7781 },
    { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'USA', lat: 33.9425, lng: -118.4081 },
    { code: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', lat: 25.2532, lng: 55.3657 },
    { code: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lng: 103.9915 },
    { code: 'PVG', name: 'Shanghai Pudong', city: 'Shanghai', country: 'China', lat: 31.1443, lng: 121.8083 },
    { code: 'YUL', name: 'Montréal-Trudeau', city: 'Montreal', country: 'Canada', lat: 45.4706, lng: -73.7408 },
    { code: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', lat: 40.4983, lng: -3.5676 },
    { code: 'BCN', name: 'Barcelona El Prat', city: 'Barcelona', country: 'Spain', lat: 41.2974, lng: 2.0833 },
    { code: 'ATH', name: 'Athens International', city: 'Athens', country: 'Greece', lat: 37.9364, lng: 23.9445 },
  ];
  return res.json({ airports: NETAFIM_AIRPORTS });
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

const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { trackContainer, trackAirShipment, getSchedules, getFlightSchedules } = require('../services/searatesService');

const router = express.Router();
const { buildSchedules } = require('../data/fallbackSchedules');

// Load MIND air shipments data
const AIR_SHIPMENTS_PATH = path.join(__dirname, '..', 'data', 'airShipments.json');
function loadAirShipments() {
  try {
    return JSON.parse(fs.readFileSync(AIR_SHIPMENTS_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Load MIND sea shipments data
const SEA_SHIPMENTS_PATH = path.join(__dirname, '..', 'data', 'seaShipments.json');
function loadSeaShipments() {
  try {
    return JSON.parse(fs.readFileSync(SEA_SHIPMENTS_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

/**
 * GET /api/containers/sea/shipments
 * Returns the MIND sea shipments list, optionally filtered by query.
 * Query params: q (search term matching shipmentNo, mbl, containers, forwarder, scac)
 */
router.get('/sea/shipments', authenticateToken, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let shipments = loadSeaShipments();
  if (q) {
    shipments = shipments.filter(s =>
      (s.shipmentNo || '').toLowerCase().includes(q) ||
      (s.mbl || '').toLowerCase().includes(q) ||
      (s.containers || []).some(c => c.toLowerCase().includes(q)) ||
      (s.forwarder || '').toLowerCase().includes(q) ||
      (s.scac || '').toLowerCase().includes(q)
    );
  }
  return res.json({ shipments, total: shipments.length });
});

/**
 * GET /api/containers/track/:number
 * Track a container by container number, B/L, or booking reference.
 * PRIORITY: Check local sea shipments data FIRST, then call the Searates API.
 * If found locally, return local data + flag for docs availability.
 */
router.get('/track/:number', authenticateToken, async (req, res) => {
  const { number } = req.params;
  const { type } = req.query;
  const query = (number || '').trim().toUpperCase();

  // 1. Check local sea shipments data first (match by MBL, container, or shipment number)
  const seaShipments = loadSeaShipments();
  const localMatch = seaShipments.find(s => {
    const mblMatch = (s.mbl || '').toUpperCase().replace(/\s/g, '') === query.replace(/\s/g, '');
    const containerMatch = (s.containers || []).some(c => c.toUpperCase() === query);
    const shipmentMatch = (s.shipmentNo || '').toUpperCase() === query;
    return mblMatch || containerMatch || shipmentMatch;
  });

  // 2. Try the Searates API
  let apiData = null;
  let apiError = null;
  try {
    apiData = await trackContainer(query, type || null);
  } catch (err) {
    apiError = err;
    console.error('Tracking API error:', err.response?.data || err.message);
  }

  // SCAC to carrier name mapping
  const SCAC_CARRIERS = {
    'ZIMU': 'ZIM Integrated Shipping',
    'MEDU': 'Mediterranean Shipping Company (MSC)',
    'MSCU': 'Mediterranean Shipping Company (MSC)',
    'MAEU': 'Maersk Line',
    'COSU': 'COSCO Shipping',
    'CMDU': 'CMA CGM',
    'ONEY': 'Ocean Network Express (ONE)',
    'ESPU': 'Evergreen Marine (ESL)',
    'HDMU': 'Hapag-Lloyd',
    'HLCU': 'Hapag-Lloyd',
  };

  // 3. If API returned valid data (not an error response), enrich with local info and return
  const apiHasRealData = apiData && apiData.data && 
    !apiData.data.error && 
    apiData.status !== 'error' &&
    !['API_KEY_LIMIT_REACHED', 'API_KEY_WRONG', 'API_KEY_ACCESS_DENIED', 'WRONG_NUMBER'].includes(apiData.message || apiData.status_code);

  if (apiHasRealData) {
    if (localMatch) {
      apiData.localShipment = localMatch;
      apiData.hasLocalDocs = true;
    }
    return res.json(apiData);
  }

  // 4. If API failed/unavailable but we have local data, return a rich structured fallback
  if (localMatch) {
    const carrierName = SCAC_CARRIERS[localMatch.scac] || localMatch.scac;
    const containers = (localMatch.containers || []).map((c, i) => ({
      number: c,
      iso_code: '45G1',
      size_type: "40' HC DRY",
      status: 'IN_TRANSIT',
      events: [],
    }));

    return res.json({
      success: true,
      status_code: 'LOCAL_DATA',
      isLocalFallback: true,
      localShipment: localMatch,
      hasLocalDocs: true,
      data: {
        metadata: {
          number: query,
          type: localMatch.containers.some(c => c.toUpperCase() === query) ? 'CT' : 'BL',
          sealine: localMatch.scac,
          sealine_name: carrierName,
          carrier_name: carrierName,
          carrier_scac: localMatch.scac,
          status: 'IN_TRANSIT',
          updated_at: new Date().toISOString(),
        },
        route: {
          pol: { location: 'pol_1', date: null },
          pod: { location: 'pod_1', date: null },
        },
        locations: [
          { id: 'pol_1', name: 'Ashdod', country: 'Israel', locode: 'ILASH', lat: 31.8167, lng: 34.6333 },
          { id: 'pod_1', name: 'Destination Port', country: '', locode: '', lat: null, lng: null },
        ],
        containers: containers,
        vessels: [],
        facilities: [],
        shipmentNo: localMatch.shipmentNo,
        mbl: localMatch.mbl,
        forwarder: localMatch.forwarder,
        scac: localMatch.scac,
        allContainers: localMatch.containers,
      }
    });
  }

  // 5. No local data and API failed — return error
  if (apiError) {
    return res.status(500).json({ error: 'Failed to fetch container tracking information', details: apiError.message });
  }
  // API returned an error object (like API_KEY_LIMIT_REACHED) with no local match
  if (apiData && (apiData.status === 'error' || apiData.message === 'API_KEY_LIMIT_REACHED')) {
    return res.status(503).json({ error: 'Tracking API unavailable (key limit reached). No local data found for this number.', details: apiData.message });
  }
  return res.json(apiData);
});

/**
 * GET /api/containers/air/track/:awb
 * Track an air shipment by Air Waybill (AWB) number.
 * Falls back to MIND air shipments data when the live API is unavailable.
 * Example: /api/containers/air/track/020-17363006
 */
router.get('/air/track/:awb', authenticateToken, async (req, res) => {
  const { awb } = req.params;

  // IATA airport coordinate lookup for known Netafim destinations
  const AIRPORT_COORDS = {
    'TLV': { iata_code: 'TLV', name: 'Ben Gurion International Airport', country: 'Israel', lat: 32.0114, lng: 34.8867 },
    'CGK': { iata_code: 'CGK', name: 'Soekarno-Hatta International Airport', country: 'Indonesia', lat: -6.1256, lng: 106.6559 },
    'CPT': { iata_code: 'CPT', name: 'Cape Town International Airport', country: 'South Africa', lat: -33.9648, lng: 18.6017 },
    'LIM': { iata_code: 'LIM', name: 'Jorge Chávez International Airport', country: 'Peru', lat: -12.0219, lng: -77.1143 },
    'JNB': { iata_code: 'JNB', name: 'O.R. Tambo International Airport', country: 'South Africa', lat: -26.1367, lng: 28.2411 },
    'NBO': { iata_code: 'NBO', name: 'Jomo Kenyatta International Airport', country: 'Kenya', lat: -1.3192, lng: 36.9275 },
    'BOM': { iata_code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', country: 'India', lat: 19.0896, lng: 72.8656 },
    'DEL': { iata_code: 'DEL', name: 'Indira Gandhi International Airport', country: 'India', lat: 28.5562, lng: 77.1000 },
    'SYD': { iata_code: 'SYD', name: 'Sydney Kingsford Smith Airport', country: 'Australia', lat: -33.9399, lng: 151.1753 },
    'MEX': { iata_code: 'MEX', name: 'Benito Juárez International Airport', country: 'Mexico', lat: 19.4363, lng: -99.0721 },
    'SCL': { iata_code: 'SCL', name: 'Arturo Merino Benítez International Airport', country: 'Chile', lat: -33.3930, lng: -70.7858 },
    'MEL': { iata_code: 'MEL', name: 'Melbourne Airport', country: 'Australia', lat: -37.6690, lng: 144.8410 },
    'SAP': { iata_code: 'SAP', name: 'Ramón Villeda Morales International Airport', country: 'Honduras', lat: 15.4526, lng: -87.9236 },
    'BCN': { iata_code: 'BCN', name: 'Barcelona–El Prat Airport', country: 'Spain', lat: 41.2974, lng: 2.0833 },
  };

  // Extract IATA code from strings like "Tel Aviv (TLV)" or just "TLV"
  const extractIATA = (str) => {
    if (!str) return null;
    const m = str.match(/\(([A-Z]{3})\)/);
    return m ? m[1] : (str.length === 3 ? str.toUpperCase() : null);
  };

  // Helper: build a structured fallback response from MIND data
  const buildFallback = (s) => {
    const originCode = extractIATA(s.origin || 'Tel Aviv (TLV)');
    const destCode = extractIATA(s.destination);
    const fromAirport = originCode ? (AIRPORT_COORDS[originCode] || { iata_code: originCode, name: s.origin, country: '', lat: null, lng: null }) : null;
    const toAirport = destCode ? (AIRPORT_COORDS[destCode] || { iata_code: destCode, name: s.destination, country: '', lat: null, lng: null }) : null;
    return ({
    success: true,
    status_code: 'FALLBACK',
    isFallback: true,
    metadata: {
      request_parameters: { number: s.awb },
      airline: {},
      updated_at: new Date().toISOString(),
    },
    data: {
      status: 'In Transit',
      awb: s.awb,
      shipmentNo: s.shipmentNo,
      type: s.type,
      forwarder: s.forwarder,
      origin: s.origin || 'Tel Aviv (TLV)',
      destination: s.destination,
      from: fromAirport,
      to: toAirport,
      routes: [],
      events: [],
    },
  });
  };

  // Helper: search local file for this AWB
  const findLocalMatch = () => {
    const shipments = loadAirShipments();
    const normalised = awb.replace(/[\s-]/g, '').toLowerCase();
    return shipments.find(s =>
      s.awb.replace(/[\s-]/g, '').toLowerCase() === normalised ||
      s.shipmentNo === awb.trim()
    );
  };

  try {
    const data = await trackAirShipment(awb);

    // API is down / key issues — fall back to local file
    const isApiDown = !data || !data.success &&
      ['API_KEY_LIMIT_REACHED', 'API_KEY_ACCESS_DENIED', 'API_KEY_WRONG'].includes(data.status_code);

    if (isApiDown) {
      const match = findLocalMatch();
      if (match) return res.json(buildFallback(match));
      return res.status(503).json({ error: 'Tracking API unavailable and no local data found for this AWB.' });
    }

    // AWB not found in API — try local file, then return API response
    const isNotFound = !data.success &&
      ['WRONG_NUMBER', 'NO_DATA', 'NOT_FOUND'].includes(data.status_code);

    if (isNotFound) {
      const match = findLocalMatch();
      if (match) return res.json(buildFallback(match));
    }

    // API returned valid data — enrich with local MIND metadata if available
    if (data && data.success) {
      const match = findLocalMatch();
      if (match) {
        // Attach MIND metadata (shipmentNo, forwarder) to the API response
        if (data.data) {
          data.data.mindShipmentNo = match.shipmentNo;
          data.data.mindForwarder = match.forwarder;
        }
      }
    }

    return res.json(data);
  } catch (err) {
    console.error('Air tracking error:', err.response?.data || err.message);
    // Network/timeout error — fall back to local file
    const match = findLocalMatch();
    if (match) return res.json(buildFallback(match));
    return res.status(500).json({ error: 'Failed to fetch air shipment tracking information', details: err.message });
  }
});

/**
 * GET /api/containers/air/shipments
 * Returns the MIND air shipments list, optionally filtered by query.
 * Query params: q (search term matching shipmentNo, awb, destination, forwarder)
 */
router.get('/air/shipments', authenticateToken, (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let shipments = loadAirShipments();
  if (q) {
    shipments = shipments.filter(s =>
      (s.shipmentNo || '').toLowerCase().includes(q) ||
      (s.awb || '').toLowerCase().includes(q) ||
      (s.destination || '').toLowerCase().includes(q) ||
      (s.forwarder || '').toLowerCase().includes(q)
    );
  }
  return res.json({ shipments, total: shipments.length });
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
    console.error('Schedules API unavailable, using fallback:', err.message);
    // Fall back to pre-seeded schedule data for Netafim's known routes
    const fallback = buildSchedules(origin || 'ILASH', destination || 'DEHAM');
    return res.json(fallback);
  }
});

/**
 * GET /api/containers/air/schedules
 * Fetch flight schedules between two airports.
 * Query params: origin, destination, departure_date, direct_only, airlines_codes
 */
router.get('/air/schedules', authenticateToken, (req, res) => {
  const { origin, destination, departure_date, direct_only } = req.query;
  const fs = require('fs');
  const path = require('path');

  // Load local air shipments data
  let airShipments = [];
  try {
    const filePath = path.join(__dirname, '../data/airShipments.json');
    airShipments = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return res.json({ trips: [], source: 'file' });
  }

  // Airport lookup table
  const AIRPORTS = {
    TLV: { name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel' },
    CGK: { name: 'Soekarno-Hatta Airport', city: 'Jakarta', country: 'Indonesia' },
    CPT: { name: 'Cape Town International', city: 'Cape Town', country: 'South Africa' },
    LIM: { name: 'Jorge Chávez Airport', city: 'Lima', country: 'Peru' },
    CDG: { name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
    FRA: { name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
    AMS: { name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands' },
    LHR: { name: 'London Heathrow', city: 'London', country: 'UK' },
    JFK: { name: 'JFK International', city: 'New York', country: 'USA' },
    DXB: { name: 'Dubai International', city: 'Dubai', country: 'UAE' },
    SIN: { name: 'Singapore Changi', city: 'Singapore', country: 'Singapore' },
    PVG: { name: 'Shanghai Pudong', city: 'Shanghai', country: 'China' },
    YUL: { name: 'Montréal-Trudeau', city: 'Montreal', country: 'Canada' },
  };

  // Extract IATA codes from origin/destination strings like "Tel Aviv (TLV)"
  const extractIATA = (str) => {
    if (!str) return null;
    const m = str.match(/\(([A-Z]{3})\)/);
    return m ? m[1] : str.toUpperCase().trim();
  };

  const originCode = (origin || '').toUpperCase().trim();
  const destCode = (destination || '').toUpperCase().trim();

  // Filter shipments matching origin and/or destination
  const matched = airShipments.filter(s => {
    const fromCode = extractIATA(s.origin);
    const toCode = extractIATA(s.destination);
    const originMatch = !originCode || fromCode === originCode;
    const destMatch = !destCode || toCode === destCode;
    return originMatch && destMatch;
  });

  if (matched.length === 0) {
    return res.json({ trips: [], source: 'file', message: 'No scheduled flights found in Netafim shipment data for this route.' });
  }

  // Build schedule trip objects from matched shipments
  const depDate = departure_date || new Date().toISOString().split('T')[0];
  const trips = matched.map((s, i) => {
    const fromCode = extractIATA(s.origin);
    const toCode = extractIATA(s.destination);
    const fromInfo = AIRPORTS[fromCode] || { city: s.origin, country: '' };
    const toInfo = AIRPORTS[toCode] || { city: s.destination, country: '' };
    // Generate realistic departure/arrival times
    const depHour = 8 + (i * 4);
    const flightHours = { 'CGK': 11, 'CPT': 8, 'LIM': 14 }[toCode] || 10;
    const arrHour = (depHour + flightHours) % 24;
    const arrDate = flightHours + depHour >= 24
      ? new Date(new Date(depDate).getTime() + 86400000).toISOString().split('T')[0]
      : depDate;
    return {
      awb: s.awb,
      shipmentNo: s.shipmentNo,
      airline_name: s.forwarder === 'FC' ? 'El Al Cargo' : 'Lufthansa Cargo',
      airline_code: s.forwarder === 'FC' ? 'LY' : 'LH',
      origin_airport_code: fromCode,
      destination_airport_code: toCode,
      departure_date: depDate,
      arrival_date: arrDate,
      direct: true,
      transit_time_hours: flightHours,
      legs: [{
        origin: fromCode,
        destination: toCode,
        from: `${fromInfo.city} (${fromCode})`,
        to: `${toInfo.city} (${toCode})`,
        departure_date: depDate,
        arrival_date: arrDate,
        departure_time: `${String(depHour).padStart(2,'0')}:00`,
        arrival_time: `${String(arrHour).padStart(2,'0')}:00`,
        airline_name: s.forwarder === 'FC' ? 'El Al Cargo' : 'Lufthansa Cargo',
        airline_code: s.forwarder === 'FC' ? 'LY' : 'LH',
        flight_number: `${s.forwarder === 'FC' ? 'LY' : 'LH'}${1200 + i}`,
        forwarder: s.forwarder,
        type: s.type
      }]
    };
  });

  return res.json({ trips, source: 'file', total: trips.length });
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

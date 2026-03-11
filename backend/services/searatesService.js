const axios = require('axios');

const SEARATES_API_KEY = process.env.SEARATES_API_KEY || 'K-3DC3C34F-93AE-40CA-9551-C04DCF963AC6';

// Correct API endpoints (verified against Searates docs)
const TRACKING_ENDPOINT = 'https://tracking.searates.com/tracking';
const AIR_TRACKING_ENDPOINT = 'https://tracking.searates.com/air';
const SCHEDULES_ENDPOINT = 'https://schedules.searates.com/api/v2/schedules/by-points';
const FLIGHT_SCHEDULES_ENDPOINT = 'https://schedules.searates.com/api/flight/v1/schedules/daily';
const AI_CHAT_ENDPOINT = 'https://ai-api.searates.com/client/stream';

/**
 * Track a container by number (or B/L number).
 * Uses the v3 tracking endpoint: GET /tracking
 * @param {string} number - Container number, B/L, or booking reference
 * @param {string} type - 'CT' (container), 'BL' (bill of lading), or null for auto-detect
 */
async function trackContainer(number, type = null) {
  const params = {
    api_key: SEARATES_API_KEY,
    number: number.trim().toUpperCase(),
  };

  // Auto-detect type if not specified
  if (type) {
    params.type = type;
  } else {
    // Container numbers are typically 4 letters + 7 digits
    if (/^[A-Z]{4}\d{7}$/.test(params.number)) {
      params.type = 'CT';
    }
    // Otherwise let the API auto-detect
  }

  const response = await axios.get(TRACKING_ENDPOINT, {
    params,
    timeout: 30000
  });
  return response.data;
}

/**
 * Track an air shipment by Air Waybill (AWB) number.
 * Uses: GET https://tracking.searates.com/air
 * @param {string} awb - Air Waybill number e.g. '020-17363006'
 */
async function trackAirShipment(awb) {
  const params = {
    api_key: SEARATES_API_KEY,
    number: awb.trim(),
    path: true
  };

  const response = await axios.get(AIR_TRACKING_ENDPOINT, {
    params,
    timeout: 30000
  });
  return response.data;
}

/**
 * Fetch ship schedules between two ports.
 * @param {string} origin - Origin port UN/LOCODE (e.g. 'ILASH')
 * @param {string} destination - Destination port UN/LOCODE (e.g. 'DEHAM')
 * @param {string} fromDate - Date in yyyy-mm-dd format
 * @param {object} options - Additional options (weeks, cargoType, directOnly)
 */
async function getSchedules(origin, destination, fromDate, options = {}) {
  const today = new Date().toISOString().split('T')[0];
  const params = {
    api_key: SEARATES_API_KEY,
    origin: (origin || 'ILASH').toUpperCase(),
    destination: (destination || 'DEHAM').toUpperCase(),
    from_date: fromDate || today,
    weeks: options.weeks || 4,
    cargo_type: options.cargoType || 'GC',
    sort: options.sort || 'DEP',
    direct_only: options.directOnly || false,
    multimodal: true
  };

  const response = await axios.get(SCHEDULES_ENDPOINT, {
    params,
    timeout: 30000
  });
  return response.data;
}

/**
 * Fetch flight schedules between two airports.
 * Uses: GET https://schedules.searates.com/api/flight/v1/schedules/daily
 * @param {string} origin - Origin airport IATA code (e.g. 'TLV')
 * @param {string} destination - Destination airport IATA code (e.g. 'CDG')
 * @param {string} departureDate - Date in yyyy-mm-dd format
 * @param {object} options - Additional options (directOnly, airlinesCodes)
 */
async function getFlightSchedules(origin, destination, departureDate, options = {}) {
  const today = new Date().toISOString().split('T')[0];
  const params = {
    api_key: SEARATES_API_KEY,
    origin_airport_code: (origin || 'TLV').toUpperCase(),
    destination_airport_code: (destination || 'CDG').toUpperCase(),
    departure_date: departureDate || today,
    direct_only: options.directOnly || false,
  };

  if (options.airlinesCodes) {
    params.airlines_codes = options.airlinesCodes;
  }

  const response = await axios.get(FLIGHT_SCHEDULES_ENDPOINT, {
    params,
    timeout: 30000
  });
  return response.data;
}

/**
 * Send a message to the Searates AI Chat Assistant (streaming).
 * Returns the full streamed response as a string.
 * @param {string} query - Natural language question
 * @param {string} clientId - Session identifier
 */
async function sendChatMessage(query, clientId = 'netafim_user') {
  const response = await axios.post(
    AI_CHAT_ENDPOINT,
    { clientId, query },
    {
      headers: {
        'Content-Type': 'application/json',
        'api-key': SEARATES_API_KEY
      },
      timeout: 30000,
      responseType: 'text'
    }
  );

  // The API returns streaming JSON — parse the last complete JSON object
  const text = response.data;
  try {
    const parsed = JSON.parse(text);
    return parsed.response || parsed;
  } catch {
    // If streaming, extract last JSON line with a response field
    const lines = text.split('\n').filter(l => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.response) return obj.response;
      } catch { /* continue */ }
    }
    return text;
  }
}

module.exports = {
  trackContainer,
  trackAirShipment,
  getSchedules,
  getFlightSchedules,
  sendChatMessage
};

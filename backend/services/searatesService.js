const axios = require('axios');

const SEARATES_API_KEY = process.env.SEARATES_API_KEY || 'K-3DC3C34F-93AE-40CA-9551-C04DCF963AC6';

// API endpoints
const TRACKING_ENDPOINT = 'https://tracking.searates.com/get/tracking';
const SCHEDULES_ENDPOINT = 'https://schedules.searates.com/api/v2/schedules';
const AI_CHAT_ENDPOINT = 'https://ai-api.searates.com/client/stream';

/**
 * Track a container by number (or B/L number).
 * Uses the v3 tracking endpoint.
 * @param {string} number - Container number, B/L, or booking reference
 * @param {string} type - 'container', 'bl', or 'booking' (default: auto-detect)
 */
async function trackContainer(number, type = null) {
  const params = {
    api_key: SEARATES_API_KEY,
    number,
    route: true,
    ais: true
  };
  if (type) params.type = type;

  const response = await axios.get(TRACKING_ENDPOINT, {
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
    origin: origin || 'ILASH',
    destination: destination || 'DEHAM',
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
  // Try to extract the response field from the streamed data
  try {
    const parsed = JSON.parse(text);
    return parsed.response || parsed;
  } catch {
    // If streaming, extract last JSON line
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
  getSchedules,
  sendChatMessage
};

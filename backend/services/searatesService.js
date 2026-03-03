const axios = require('axios');

// Base URLs for Searates APIs.  See https://docs.searates.com/reference for details.
const TRACKING_ENDPOINT = 'https://api.searates.com/tracking/container';
const SCHEDULES_ENDPOINT = 'https://api.searates.com/schedules';
const CHAT_ENDPOINT = 'https://api.searates.com/ai/chat';

/**
 * Helper function to build query strings with the API key.
 */
function buildParams(params = {}) {
  return { key: process.env.SEARATES_API_KEY, ...params };
}

/**
 * Track a single container by its container number.  Returns tracking details
 * as provided by Searates.  See docs.searates.com/reference/tracking/introduction.
 *
 * @param {string} containerId
 */
async function trackContainer(containerId) {
  const params = buildParams({ code: containerId });
  const response = await axios.get(TRACKING_ENDPOINT, { params });
  return response.data;
}

/**
 * Fetch ship schedules.  Accepts optional parameters such as origin, destination and date.
 * See docs.searates.com/reference/schedules/introduction for options.
 */
async function getSchedules(portFrom, portTo, date) {
  const params = buildParams({ portFrom, portTo, date });
  const response = await axios.get(SCHEDULES_ENDPOINT, { params });
  return response.data;
}

/**
 * Send a message to the Searates AI Chat Assistant.
 * See docs.searates.com/reference/ai/general-information for details.
 */
async function sendChatMessage(message) {
  const params = buildParams();
  const response = await axios.post(CHAT_ENDPOINT, { message }, { params });
  return response.data;
}

module.exports = {
  trackContainer,
  getSchedules,
  sendChatMessage
};
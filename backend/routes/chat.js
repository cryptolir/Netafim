const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { sendChatMessage } = require('../services/searatesService');
const axios = require('axios');

const router = express.Router();

// ── Load shipment datasets ────────────────────────────────────────────────────
function loadJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return []; }
}

const SEA_PATH = path.join(__dirname, '..', 'data', 'seaShipments.json');
const AIR_PATH = path.join(__dirname, '..', 'data', 'airShipments.json');

function buildShipmentContext() {
  const seaShipments = loadJSON(SEA_PATH);
  const airShipments = loadJSON(AIR_PATH);

  const seaLines = seaShipments.map(s =>
    `  - Shipment ${s.shipmentNo} | MBL: ${s.mbl} | Containers: ${s.containers.join(', ')} | Forwarder: ${s.forwarder} | Carrier SCAC: ${s.scac}`
  ).join('\n');

  const airLines = airShipments.map(s =>
    `  - Shipment ${s.shipmentNo} | AWB: ${s.awb} | Destination: ${s.destination} | Forwarder: ${s.forwarder}`
  ).join('\n');

  return `
NETAFIM ACTIVE SHIPMENTS (as of latest data export):

SEA SHIPMENTS (${seaShipments.length} shipments):
${seaLines || '  (none)'}

AIR SHIPMENTS (${airShipments.length} shipments):
${airLines || '  (none)'}

Use this data to answer questions about specific shipments, containers, MBLs, AWBs, forwarders, and carriers.
When a user asks about a shipment or container, look it up in the data above and provide the relevant details.
If a shipment is not in this list, say so clearly.
`;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `You are a helpful logistics and supply chain assistant for Netafim, a global leader in drip irrigation solutions.
You help users with container tracking, port schedules, SAP sales orders, shipping routes, export documentation, and general logistics questions.
Be concise, professional, and helpful. Always respond in the same language the user writes in (English or French).`;

/**
 * POST /api/chat
 * Send a question to the AI Chat Assistant.
 * Expects: { "message": "...", "history": [...], "sessionId": "..." }
 */
router.post('/', authenticateToken, async (req, res) => {
  const { message, history = [], sessionId = 'netafim_session' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Build full system prompt with live shipment data
  const shipmentContext = buildShipmentContext();
  const fullSystemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + shipmentContext;

  // Try Searates AI first (no shipment context injection possible there)
  try {
    const reply = await sendChatMessage(message, sessionId);
    return res.json({ reply, source: 'searates' });
  } catch (searatesErr) {
    console.warn('Searates AI failed, falling back to OpenAI:', searatesErr.message);
  }

  // Fallback to OpenAI — inject full shipment context
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.CHAT_MODEL || 'gpt-4.1-mini';

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message }
    ];

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      { model, messages, max_tokens: 600, temperature: 0.5 },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0].message.content;
    return res.json({ reply, source: 'openai' });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;

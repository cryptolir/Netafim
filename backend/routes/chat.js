const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { trackContainer, trackAirShipment, getSchedules } = require('../services/searatesService');
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
    `  - Shipment ${s.shipmentNo} | AWB: ${s.awb} | Origin: ${s.origin} | Destination: ${s.destination} | Forwarder: ${s.forwarder} | Carrier: ${s.carrier}`
  ).join('\n');

  return `
NETAFIM ACTIVE SHIPMENTS (as of latest data export):

SEA SHIPMENTS (${seaShipments.length} shipments):
${seaLines || '  (none)'}

AIR SHIPMENTS (${airShipments.length} shipments):
${airLines || '  (none)'}

Use this data to answer questions about specific shipments, containers, MBLs, AWBs, forwarders, and carriers.
When a user asks about a shipment or container, first look it up in the data above.
You also have access to LIVE API tools to get real-time tracking data and schedules — USE THEM when the user asks for tracking status, vessel position, flight status, or sailing schedules.
`;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const BASE_SYSTEM_PROMPT = `You are a helpful logistics and supply chain assistant for Netafim, a global leader in drip irrigation solutions.
You help users with container tracking, air shipment tracking, port schedules, shipping routes, export documentation, and general logistics questions.
Be concise, professional, and helpful. Always respond in the same language the user writes in (English, Hebrew, or French).

IMPORTANT: When a user asks about tracking a container, MBL, AWB, or shipment — you MUST use the appropriate tool to fetch live data. Do NOT just look at the static shipment list.
When a user asks about sailing schedules between ports — use the get_ship_schedules tool.
When a user asks about a specific container or MBL — use the track_container tool.
When a user asks about an air shipment or AWB — use the track_air_shipment tool.
When a user asks to search shipments by forwarder, carrier, etc. — use the search_shipments tool.

Format your responses nicely with bullet points and key details. Include status, ETAs, vessel/flight names, and route information when available.`;

// ── OpenAI Function/Tool definitions ──────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'track_container',
      description: 'Track a sea container, MBL (Master Bill of Lading), or booking reference in real-time using the Searates tracking API. Use this when the user asks about the status, location, or ETA of a container or sea shipment.',
      parameters: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'The container number (e.g. MSCU1234567), MBL number (e.g. ZIMUMER25802993), or booking reference to track'
          },
          type: {
            type: 'string',
            enum: ['CT', 'BL', 'BK'],
            description: 'Type of number: CT=container, BL=bill of lading, BK=booking. If unsure, omit and let the API auto-detect.'
          }
        },
        required: ['number']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'track_air_shipment',
      description: 'Track an air shipment by Air Waybill (AWB) number using the Searates air tracking API. Use this when the user asks about the status of an air shipment or AWB.',
      parameters: {
        type: 'object',
        properties: {
          awb: {
            type: 'string',
            description: 'The Air Waybill number, e.g. 70051280213 or 700-51280213'
          }
        },
        required: ['awb']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ship_schedules',
      description: 'Get vessel sailing schedules between two ports. Use this when the user asks about upcoming sailings, vessel schedules, or shipping options between ports.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: 'Origin port UN/LOCODE (e.g. ILASH for Ashdod, ILHFA for Haifa, CNSHA for Shanghai, DEHAM for Hamburg)'
          },
          destination: {
            type: 'string',
            description: 'Destination port UN/LOCODE (e.g. DEHAM for Hamburg, NLRTM for Rotterdam, BEANR for Antwerp)'
          },
          weeks: {
            type: 'number',
            description: 'Number of weeks to search ahead (default 4)'
          }
        },
        required: ['origin', 'destination']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_shipments',
      description: 'Search Netafim\'s shipment database by any criteria: shipment number, MBL, container number, AWB, forwarder name, carrier SCAC code, or type (Sea/Air). Use this when the user asks to find or list shipments.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — can be a shipment number, MBL, container number, AWB, forwarder name (e.g. UNICARGO, BDL, GOA, Rosenthal), carrier SCAC (e.g. ZIMU, MSCU, MAEU), or type (Sea, Air)'
          }
        },
        required: ['query']
      }
    }
  }
];

// ── Tool execution functions ──────────────────────────────────────────────────

async function executeTrackContainer(args) {
  const { number, type } = args;
  try {
    const data = await trackContainer(number, type || null);
    
    // Check if API returned real data
    const hasRealData = data && data.data && 
      !data.data.error && 
      data.status !== 'error' &&
      !['API_KEY_LIMIT_REACHED', 'API_KEY_WRONG', 'WRONG_NUMBER'].includes(data.message || data.status_code);
    
    if (hasRealData) {
      // Extract key info from the API response
      const d = data.data;
      const containers = d.containers || [];
      const route = d.route || {};
      const events = [];
      containers.forEach(c => {
        (c.events || []).slice(-5).forEach(e => {
          events.push({ date: e.date, status: e.description || e.status, location: e.location, vessel: e.vessel });
        });
      });
      
      return JSON.stringify({
        source: 'live_api',
        status: d.status || route.status || 'Unknown',
        carrier: route.carrier?.name || d.carrier_name || '',
        vessel: route.vessel?.name || '',
        origin: route.origin || {},
        destination: route.destination || {},
        containers: containers.map(c => ({
          number: c.number,
          size: c.size_type,
          status: c.status,
          last_event: (c.events || []).slice(-1)[0] || null
        })),
        recent_events: events.slice(-8),
        eta: route.destination?.estimated_date || route.eta || '',
        transit_time: route.transit_time || ''
      });
    }
    
    // Fall back to local data
    return executeSearchShipments({ query: number });
  } catch (err) {
    console.error('Track container tool error:', err.message);
    // Try local data
    return executeSearchShipments({ query: number });
  }
}

async function executeTrackAirShipment(args) {
  let { awb } = args;
  
  // Try with dash format if needed
  const tryFormats = [awb];
  const clean = awb.replace(/[\s-]/g, '');
  if (clean.length >= 10 && !awb.includes('-')) {
    tryFormats.push(clean.substring(0, 3) + '-' + clean.substring(3));
  }
  
  for (const fmt of tryFormats) {
    try {
      const data = await trackAirShipment(fmt);
      const hasRealData = data && data.data && 
        !['WRONG_NUMBER', 'API_KEY_LIMIT_REACHED'].includes(data.status_code);
      
      if (hasRealData) {
        const d = data.data;
        const routes = d.routes || [];
        const events = (d.events || []).slice(-10);
        
        return JSON.stringify({
          source: 'live_api',
          status: d.status || 'Unknown',
          awb: d.awb || awb,
          airline: data.metadata?.airline?.name || '',
          origin: d.from || {},
          destination: d.to || {},
          routes: routes.map(r => ({
            from: r.from?.iata_code || r.from?.name || '',
            to: r.to?.iata_code || r.to?.name || '',
            flight: r.flight_number || '',
            departure: r.departure || '',
            arrival: r.arrival || '',
            pieces: r.pieces || '',
            weight: r.weight || '',
            status: r.status || ''
          })),
          events: events.map(e => ({
            date: e.date || '',
            status: e.status || e.description || '',
            location: e.location || '',
            flight: e.flight || ''
          }))
        });
      }
    } catch (err) {
      console.error(`Air track error for ${fmt}:`, err.message);
    }
  }
  
  // Fall back to local air shipments data
  const airShipments = loadJSON(AIR_PATH);
  const normalised = clean.toLowerCase();
  const match = airShipments.find(s => 
    (s.awb || '').replace(/[\s-]/g, '').toLowerCase() === normalised
  );
  
  if (match) {
    return JSON.stringify({
      source: 'local_data',
      awb: match.awb,
      shipmentNo: match.shipmentNo,
      type: match.type,
      forwarder: match.forwarder,
      carrier: match.carrier,
      origin: match.origin,
      destination: match.destination,
      flights: match.flights || [],
      pieces: match.pieces,
      weight: match.weight
    });
  }
  
  return JSON.stringify({ source: 'not_found', message: `No data found for AWB ${awb}` });
}

async function executeGetShipSchedules(args) {
  const { origin, destination, weeks } = args;
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await getSchedules(origin, destination, today, {
      weeks: weeks || 4,
      cargoType: 'GC',
      directOnly: false,
      sort: 'DEP'
    });
    
    const schedules = (data?.data?.schedules || data?.schedules || []).slice(0, 10);
    const stats = (data?.metadata?.response_stats || [])
      .filter(s => s.found_schedules > 0)
      .map(s => `${s.carrier_name}: ${s.found_schedules}`);
    
    return JSON.stringify({
      source: 'live_api',
      origin,
      destination,
      total_schedules: schedules.length,
      carriers_with_results: stats,
      schedules: schedules.map(s => ({
        carrier: s.carrier_name || s.carrier_scac || '',
        vessel: s.legs?.[0]?.vessel_name || '',
        service: s.legs?.[0]?.service_name || '',
        departure: s.origin?.estimated_date || '',
        arrival: s.destination?.estimated_date || '',
        transit_days: s.transit_time || '',
        direct: s.direct,
        legs: (s.legs || []).length
      }))
    });
  } catch (err) {
    console.error('Ship schedules tool error:', err.message);
    return JSON.stringify({ source: 'error', message: `Could not fetch schedules: ${err.message}` });
  }
}

function executeSearchShipments(args) {
  const { query } = args;
  const q = (query || '').toLowerCase().trim();
  
  const seaShipments = loadJSON(SEA_PATH);
  const airShipments = loadJSON(AIR_PATH);
  
  const seaMatches = seaShipments.filter(s =>
    (s.shipmentNo || '').toLowerCase().includes(q) ||
    (s.mbl || '').toLowerCase().includes(q) ||
    (s.containers || []).some(c => c.toLowerCase().includes(q)) ||
    (s.forwarder || '').toLowerCase().includes(q) ||
    (s.scac || '').toLowerCase().includes(q) ||
    (s.type || '').toLowerCase().includes(q)
  );
  
  const airMatches = airShipments.filter(s =>
    (s.awb || '').replace(/[\s-]/g, '').toLowerCase().includes(q.replace(/[\s-]/g, '')) ||
    (s.shipmentNo || '').toLowerCase().includes(q) ||
    (s.forwarder || '').toLowerCase().includes(q) ||
    (s.carrier || '').toLowerCase().includes(q) ||
    (s.carrierCode || '').toLowerCase().includes(q) ||
    (s.destination || '').toLowerCase().includes(q) ||
    (s.type || '').toLowerCase().includes(q)
  );
  
  return JSON.stringify({
    source: 'local_data',
    query: q,
    sea_shipments: seaMatches.map(s => ({
      shipmentNo: s.shipmentNo,
      mbl: s.mbl,
      containers: s.containers,
      forwarder: s.forwarder,
      scac: s.scac,
      type: s.type
    })),
    air_shipments: airMatches.map(s => ({
      shipmentNo: s.shipmentNo,
      awb: s.awb,
      forwarder: s.forwarder,
      carrier: s.carrier,
      origin: s.origin,
      destination: s.destination,
      type: s.type
    })),
    total_found: seaMatches.length + airMatches.length
  });
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case 'track_container':
      return await executeTrackContainer(args);
    case 'track_air_shipment':
      return await executeTrackAirShipment(args);
    case 'get_ship_schedules':
      return await executeGetShipSchedules(args);
    case 'search_shipments':
      return executeSearchShipments(args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/**
 * POST /api/chat
 * Send a question to the AI Chat Assistant with function-calling for live API data.
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

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.CHAT_MODEL || 'gpt-4.1-mini';

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...history.slice(-10),
      { role: 'user', content: message }
    ];

    // First call — may return tool_calls
    let response = await axios.post(
      `${baseURL}/chat/completions`,
      { model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 1200, temperature: 0.3 },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 45000
      }
    );

    let assistantMessage = response.data.choices[0].message;

    // Handle tool calls (up to 3 rounds of tool calling)
    let rounds = 0;
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && rounds < 3) {
      rounds++;
      console.log(`Chat tool call round ${rounds}:`, assistantMessage.tool_calls.map(tc => tc.function.name));

      // Add assistant message with tool_calls to conversation
      messages.push(assistantMessage);

      // Execute each tool call and add results
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Failed to parse tool args:', toolCall.function.arguments);
        }

        console.log(`Executing tool: ${fnName}`, fnArgs);
        const result = await executeTool(fnName, fnArgs);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }

      // Call the model again with tool results
      response = await axios.post(
        `${baseURL}/chat/completions`,
        { model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 1200, temperature: 0.3 },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 45000
        }
      );

      assistantMessage = response.data.choices[0].message;
    }

    const reply = assistantMessage.content || 'I was unable to generate a response. Please try again.';
    return res.json({ reply, source: 'openai' });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;

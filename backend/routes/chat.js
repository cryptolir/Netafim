const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const axios = require('axios');

const router = express.Router();

const SYSTEM_PROMPT = `You are a helpful logistics and supply chain assistant for Netafim, a global leader in drip irrigation solutions.
You help users with:
- Container tracking and shipment status
- Port schedules and vessel arrivals
- SAP sales orders and order status
- Shipping routes and estimated delivery times
- Export documentation and customs queries
- General logistics and supply chain questions

Be concise, professional, and helpful. If you don't have real-time data, explain that and offer guidance on how to obtain it.
Always respond in the same language the user writes in (English or French).`;

/**
 * POST /api/chat
 * Send a question to the AI logistics assistant.
 * Expects a JSON body: { "message": "...", "history": [...] }
 */
router.post('/', authenticateToken, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.CHAT_MODEL || 'gpt-4.1-mini';

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-10), // keep last 10 messages for context
      { role: 'user', content: message }
    ];

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        messages,
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const reply = response.data.choices[0].message.content;
    return res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;

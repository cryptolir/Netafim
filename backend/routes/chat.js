const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { sendChatMessage } = require('../services/searatesService');
const axios = require('axios');

const router = express.Router();

const OPENAI_SYSTEM_PROMPT = `You are a helpful logistics and supply chain assistant for Netafim, a global leader in drip irrigation solutions.
You help users with container tracking, port schedules, SAP sales orders, shipping routes, export documentation, and general logistics questions.
Be concise, professional, and helpful. Always respond in the same language the user writes in (English or French).`;

/**
 * POST /api/chat
 * Send a question to the Searates AI Chat Assistant (with OpenAI fallback).
 * Expects: { "message": "...", "history": [...], "sessionId": "..." }
 */
router.post('/', authenticateToken, async (req, res) => {
  const { message, history = [], sessionId = 'netafim_session' } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Try Searates AI first
  try {
    const reply = await sendChatMessage(message, sessionId);
    return res.json({ reply, source: 'searates' });
  } catch (searatesErr) {
    console.warn('Searates AI failed, falling back to OpenAI:', searatesErr.message);
  }

  // Fallback to OpenAI
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.CHAT_MODEL || 'gpt-4.1-mini';

    const messages = [
      { role: 'system', content: OPENAI_SYSTEM_PROMPT },
      ...history.slice(-10),
      { role: 'user', content: message }
    ];

    const response = await axios.post(
      `${baseURL}/chat/completions`,
      { model, messages, max_tokens: 500, temperature: 0.7 },
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

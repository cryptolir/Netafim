const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { sendChatMessage } = require('../services/searatesService');

const router = express.Router();

/**
 * POST /api/chat
 * Send a question to the Searates AI Chat Assistant.  Expects a JSON body:
 * { "message": "..." }
 */
router.post('/', authenticateToken, async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  try {
    const data = await sendChatMessage(message);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to get chat response' });
  }
});

module.exports = router;
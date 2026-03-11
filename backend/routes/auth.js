const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Demo users store.  Replace this with your identity provider or database.
const users = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'client', password: 'client123', role: 'client' }
];

/**
 * POST /api/auth/login
 * Authenticate a user and return a JWT.  In production, integrate with
 * Azure AD or another identity provider via OAuth/OIDC.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const payload = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
  return res.json({ token });
});

module.exports = router;
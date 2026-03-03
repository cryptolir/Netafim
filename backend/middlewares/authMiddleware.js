const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT and attach user information to the request.
 * If the token is invalid or missing, a 401 response is returned.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Expect token in the format "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    console.error(err);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
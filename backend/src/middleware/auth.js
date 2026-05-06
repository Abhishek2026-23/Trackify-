const jwt = require('jsonwebtoken');

// Verify JWT token — returns 401 if missing or invalid
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Optional auth — attaches req.user if a valid token is present,
// but never blocks the request. Use on endpoints that work for both
// authenticated and anonymous clients (e.g. location updates from
// drivers that may not have refreshed their token yet).
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (!err) req.user = user;
      next();
    });
  } else {
    next();
  }
};

// Generic role-based access control
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.user_type)) {
    return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
  }
  next();
};

const requireAdmin = requireRole('admin');
const requireOperator = requireRole('admin', 'operator');
const requireDriver = requireRole('driver');

module.exports = { authenticateToken, optionalAuth, requireRole, requireAdmin, requireOperator, requireDriver };

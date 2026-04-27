const jwt = require('jsonwebtoken');

// Verify JWT token
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

module.exports = { authenticateToken, requireRole, requireAdmin, requireOperator, requireDriver };

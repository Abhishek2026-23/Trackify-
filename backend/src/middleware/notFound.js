// 404 handler for undefined routes
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
};

module.exports = notFound;

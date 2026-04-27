const express = require('express');
const { validate } = require('../middleware/validator');
const { authenticateToken, requireAdmin, requireOperator, requireDriver } = require('../middleware/auth');

const authController = require('../controllers/authController');
const locationController = require('../controllers/locationController');
const routeController = require('../controllers/routeController');
const busController = require('../controllers/busController');
const etaController = require('../controllers/etaController');
const tripController = require('../controllers/tripController');
const alertController = require('../controllers/alertController');

const router = express.Router();

// ── Auth ──────────────────────────────────────────────────────────
router.post('/auth/login', validate('login'), authController.login);
router.post('/auth/register', validate('register'), authController.register);
router.post('/auth/refresh', authController.refreshToken);
router.post('/auth/logout', authenticateToken, authController.logout);

// ── Location ──────────────────────────────────────────────────────
router.post('/location/update', validate('locationUpdate'), locationController.updateLocation);
router.post('/location/passenger', validate('passengerLocation'), locationController.updatePassengerLocation);
router.post('/location/offline', locationController.driverOffline);
router.post('/location/passenger/offline', locationController.passengerOffline);
router.get('/buses/live', locationController.getLiveLocations);
router.get('/drivers/nearby', locationController.getNearbyDrivers);

// ── Routes ────────────────────────────────────────────────────────
router.get('/routes', routeController.getAllRoutes);
router.get('/routes/:id', routeController.getRouteById);
router.post('/routes', authenticateToken, requireOperator, validate('createRoute'), routeController.createRoute);
router.put('/routes/:id', authenticateToken, requireOperator, routeController.updateRoute);
router.delete('/routes/:id', authenticateToken, requireOperator, routeController.deactivateRoute);

// ── Buses ─────────────────────────────────────────────────────────
router.get('/buses', busController.getActiveBuses);
router.get('/buses/:id', busController.getBusById);

// ── Trips ─────────────────────────────────────────────────────────
router.post('/trips', authenticateToken, requireDriver, validate('tripStart'), tripController.startTrip);
router.put('/trips/:id/end', authenticateToken, requireDriver, tripController.endTrip);
router.get('/trips/active', authenticateToken, requireOperator, tripController.getActiveTrips);

// ── Alerts ────────────────────────────────────────────────────────
router.get('/alerts', alertController.getActiveAlerts);
router.post('/alerts', authenticateToken, requireOperator, validate('createAlert'), alertController.createAlert);
router.put('/alerts/:id/resolve', authenticateToken, requireOperator, alertController.resolveAlert);

// ── ETA ───────────────────────────────────────────────────────────
router.get('/stops/:id/eta', etaController.getStopETA);

// ── Health ────────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  const pool = require('../config/database');
  const redisClient = require('../config/redis');
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';
  try { await pool.query('SELECT 1'); dbStatus = 'connected'; } catch {}
  try { await redisClient.ping(); redisStatus = 'connected'; } catch {}
  res.json({ status: 'ok', timestamp: new Date().toISOString(), database: dbStatus, redis: redisStatus });
});

module.exports = router;

const pool = require('../config/database');
const redisClient = require('../config/redis');
const { getDistance } = require('geolib');

// Calculate ETA for a stop
const getStopETA = async (req, res) => {
  try {
    const { id } = req.params; // stop_id
    const { trip_id } = req.query;

    // Get stop location
    const stopResult = await pool.query('SELECT * FROM bus_stops WHERE id = $1', [id]);
    if (stopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found' });
    }
    const stop = stopResult.rows[0];

    // Get trip details
    const tripResult = await pool.query('SELECT * FROM trips WHERE id = $1', [trip_id]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const trip = tripResult.rows[0];

    // Get current bus location from Redis
    const locationData = await redisClient.get(`bus:location:${trip.bus_id}`);
    if (!locationData) {
      return res.status(404).json({ error: 'Bus location not available' });
    }

    const location = JSON.parse(locationData);
    
    // Calculate distance in meters
    const distance = getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: stop.latitude, longitude: stop.longitude }
    );

    // Calculate ETA (assuming average speed of 30 km/h in city)
    const avgSpeed = location.speed > 0 ? location.speed : 30;
    const etaMinutes = Math.round((distance / 1000) / (avgSpeed / 60));

    res.json({
      stop_id: id,
      stop_name: stop.stop_name,
      distance_meters: distance,
      eta_minutes: etaMinutes,
      current_speed: location.speed,
    });
  } catch (error) {
    console.error('ETA calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate ETA' });
  }
};

module.exports = { getStopETA };

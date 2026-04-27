const pool = require('../config/database');
const redisClient = require('../config/redis');
const { getIO } = require('../socket');

const DRIVER_LOCATION_TTL = parseInt(process.env.LOCATION_CACHE_TTL || '30');
const PASSENGER_LOCATION_TTL = 60;
const LOG_RATE_LIMIT_TTL = 10; // seconds between PG writes per driver

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Update driver/bus location
const updateLocation = async (req, res) => {
  try {
    const { trip_id, bus_id, driverId, latitude, longitude, speed, heading, accuracy, isAvailable } = req.validatedData;

    const key = driverId ? `driver:location:${driverId}` : `bus:location:${bus_id}`;
    const entityId = driverId || bus_id;

    // Build location payload
    let locationData = {
      trip_id: trip_id || null,
      bus_id: bus_id || null,
      driverId: driverId || null,
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 10,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      timestamp: new Date().toISOString(),
    };

    // Enrich with driver profile if driverId provided
    if (driverId) {
      const dp = await pool.query(
        `SELECT dp.vehicle_type, dp.vehicle_number, u.name as driver_name
         FROM driver_profiles dp JOIN users u ON dp.user_id = u.id
         WHERE u.id = (SELECT user_id FROM driver_profiles WHERE id = (
           SELECT id FROM driver_profiles WHERE vehicle_number = $1 LIMIT 1
         ))`,
        [driverId]
      ).catch(() => ({ rows: [] }));
      if (dp.rows.length > 0) {
        locationData = { ...locationData, ...dp.rows[0] };
      }
    }

    // Store in Redis
    await redisClient.setEx(key, DRIVER_LOCATION_TTL, JSON.stringify(locationData));

    // Rate-limited PG write (max 1 per 10s per driver)
    if (trip_id && bus_id) {
      const rateLimitKey = `location:last_log:${entityId}`;
      const lastLog = await redisClient.get(rateLimitKey);
      if (!lastLog) {
        await redisClient.setEx(rateLimitKey, LOG_RATE_LIMIT_TTL, '1');
        setImmediate(async () => {
          try {
            await pool.query(
              'INSERT INTO location_logs (trip_id, bus_id, latitude, longitude, speed, heading, accuracy) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [trip_id, bus_id, latitude, longitude, speed, heading, accuracy]
            );
          } catch (err) {
            console.error('Failed to log location to PG:', err.message);
          }
        });
      }
    }

    // Broadcast to route room
    const io = getIO();
    const room = trip_id ? `route:${trip_id}` : 'all';
    io.to(room).emit('driver_location_update', locationData);
    io.emit('driver_location_update', locationData); // also broadcast globally for demo

    res.json({ success: true });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

// Get nearby drivers within radius
const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 5, vehicleType } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const pLat = parseFloat(lat);
    const pLng = parseFloat(lng);
    const r = parseFloat(radius);
    const now = Date.now();

    // Scan all driver location keys from Redis
    const keys = await redisClient.keys('driver:location:*');
    const nearby = [];

    for (const key of keys) {
      const raw = await redisClient.get(key);
      if (!raw) continue;
      const loc = JSON.parse(raw);

      if (!loc.isAvailable) continue;
      if (vehicleType && loc.vehicle_type !== vehicleType) continue;
      // Skip stale (older than TTL)
      if (now - new Date(loc.timestamp).getTime() > DRIVER_LOCATION_TTL * 1000) continue;

      const dist = haversineKm(pLat, pLng, loc.latitude, loc.longitude);
      if (dist <= r) {
        const speed = loc.speed > 0 ? loc.speed : 30;
        nearby.push({
          ...loc,
          distance_km: parseFloat(dist.toFixed(2)),
          eta_minutes: Math.round(dist / speed * 60),
        });
      }
    }

    nearby.sort((a, b) => a.distance_km - b.distance_km);
    res.json({ drivers: nearby });
  } catch (error) {
    console.error('Nearby drivers error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby drivers' });
  }
};

// Get live bus locations (for admin/dashboard)
const getLiveLocations = async (req, res) => {
  try {
    const { route_id } = req.query;

    let query = `
      SELECT t.id as trip_id, t.bus_id, b.bus_number, b.bus_type,
             r.route_number, r.route_name, r.id as route_id
      FROM trips t
      JOIN buses b ON t.bus_id = b.id
      JOIN routes r ON t.route_id = r.id
      WHERE t.trip_status = 'active'
    `;
    const params = [];
    if (route_id) { query += ' AND t.route_id = $1'; params.push(route_id); }

    const result = await pool.query(query, params);

    const locations = await Promise.all(
      result.rows.map(async (trip) => {
        const cached = await redisClient.get(`bus:location:${trip.bus_id}`);
        return { ...trip, location: cached ? JSON.parse(cached) : null };
      })
    );

    res.json({ buses: locations.filter(b => b.location !== null) });
  } catch (error) {
    console.error('Get live locations error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
};

// Update passenger location
const updatePassengerLocation = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.validatedData;
    const loc = { userId, latitude, longitude, timestamp: new Date().toISOString() };
    await redisClient.setEx(`passenger:location:${userId}`, PASSENGER_LOCATION_TTL, JSON.stringify(loc));
    const io = getIO();
    io.emit('passenger_location_update', loc);
    res.json({ success: true });
  } catch (error) {
    console.error('Passenger location error:', error);
    res.status(500).json({ error: 'Failed to update passenger location' });
  }
};

// Driver goes offline
const driverOffline = async (req, res) => {
  try {
    const { driverId, bus_id } = req.body;
    const key = driverId ? `driver:location:${driverId}` : `bus:location:${bus_id}`;
    await redisClient.del(key);
    const io = getIO();
    io.emit('driver_offline', { driverId, bus_id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark driver offline' });
  }
};

// Passenger goes offline
const passengerOffline = async (req, res) => {
  try {
    const userId = req.body && req.body.userId;
    if (userId) {
      await redisClient.del(`passenger:location:${userId}`);
      const io = getIO();
      io.emit('passenger_offline', { userId });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark passenger offline' });
  }
};

module.exports = {
  updateLocation,
  getNearbyDrivers,
  getLiveLocations,
  updatePassengerLocation,
  driverOffline,
  passengerOffline,
};

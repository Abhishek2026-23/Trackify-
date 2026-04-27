const pool = require('../config/database');
const redisClient = require('../config/redis');
const { getIO } = require('../socket');

// Start a trip
const startTrip = async (req, res) => {
  try {
    const { bus_id, route_id } = req.validatedData;

    // Check for existing active trip on this bus
    const existing = await pool.query(
      "SELECT id FROM trips WHERE bus_id = $1 AND trip_status = 'active'",
      [bus_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bus already has an active trip' });
    }

    // Find driver_id from user's driver profile
    const driverResult = await pool.query(
      'SELECT d.id FROM drivers d JOIN users u ON u.phone = d.phone WHERE u.id = $1',
      [req.user.id]
    ).catch(() => ({ rows: [] }));

    const driver_id = driverResult.rows.length > 0 ? driverResult.rows[0].id : 1;

    const result = await pool.query(
      `INSERT INTO trips (bus_id, driver_id, route_id, trip_status, scheduled_start_time, actual_start_time)
       VALUES ($1, $2, $3, 'active', NOW(), NOW()) RETURNING *`,
      [bus_id, driver_id, route_id]
    );

    res.status(201).json({ trip: result.rows[0] });
  } catch (error) {
    console.error('Start trip error:', error);
    res.status(500).json({ error: 'Failed to start trip' });
  }
};

// End a trip
const endTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE trips SET trip_status = 'completed', actual_end_time = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ trip: result.rows[0] });
  } catch (error) {
    console.error('End trip error:', error);
    res.status(500).json({ error: 'Failed to end trip' });
  }
};

// Get all active trips
const getActiveTrips = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM active_trips_view');

    // Enrich with Redis location
    const trips = await Promise.all(
      result.rows.map(async (trip) => {
        const cached = await redisClient.get(`bus:location:${trip.bus_id || trip.trip_id}`).catch(() => null);
        return { ...trip, location: cached ? JSON.parse(cached) : null };
      })
    );

    res.json({ trips });
  } catch (error) {
    console.error('Get active trips error:', error);
    res.status(500).json({ error: 'Failed to fetch active trips' });
  }
};

// Background job: mark stale trips
const checkStaleTrips = async () => {
  try {
    const result = await pool.query(
      `UPDATE trips SET trip_status = 'stale'
       WHERE trip_status = 'active'
         AND actual_start_time < NOW() - INTERVAL '12 hours'
       RETURNING id, route_id`
    );
    for (const trip of result.rows) {
      await pool.query(
        `INSERT INTO alerts (trip_id, route_id, alert_type, message, severity)
         VALUES ($1, $2, 'delay', 'Trip has been active for over 12 hours with no updates', 'warning')`,
        [trip.id, trip.route_id]
      );
    }
    if (result.rows.length > 0) {
      console.log(`Marked ${result.rows.length} stale trips`);
    }
  } catch (error) {
    console.error('Stale trip check error:', error.message);
  }
};

module.exports = { startTrip, endTrip, getActiveTrips, checkStaleTrips };

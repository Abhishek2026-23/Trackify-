const pool = require('../config/database');

// Get all routes
const getAllRoutes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM routes WHERE is_active = true ORDER BY route_number'
    );
    res.json({ routes: result.rows });
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
};

// Get route details with stops
const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM route_details_view WHERE route_id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ route: result.rows[0] });
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ error: 'Failed to fetch route' });
  }
};

// Create a new route with stops
const createRoute = async (req, res) => {
  const client = await pool.connect();
  try {
    const { route_number, route_name, start_point, end_point, total_distance, estimated_duration, stops } = req.validatedData;
    await client.query('BEGIN');

    const routeResult = await client.query(
      `INSERT INTO routes (route_number, route_name, start_point, end_point, total_distance, estimated_duration)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [route_number, route_name, start_point, end_point, total_distance || null, estimated_duration || null]
    );
    const route = routeResult.rows[0];

    if (stops && stops.length > 0) {
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const stopResult = await client.query(
          `INSERT INTO bus_stops (stop_name, stop_code, latitude, longitude, address)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [s.stop_name, s.stop_code || null, s.latitude, s.longitude, s.address || null]
        );
        await client.query(
          `INSERT INTO route_stops (route_id, stop_id, stop_sequence) VALUES ($1, $2, $3)`,
          [route.id, stopResult.rows[0].id, i + 1]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ route });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Route number already exists' });
    console.error('Create route error:', error);
    res.status(500).json({ error: 'Failed to create route' });
  } finally {
    client.release();
  }
};

// Update a route
const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { route_name, start_point, end_point, total_distance, estimated_duration } = req.body;
    const result = await pool.query(
      `UPDATE routes SET route_name = COALESCE($1, route_name), start_point = COALESCE($2, start_point),
       end_point = COALESCE($3, end_point), total_distance = COALESCE($4, total_distance),
       estimated_duration = COALESCE($5, estimated_duration) WHERE id = $6 RETURNING *`,
      [route_name, start_point, end_point, total_distance, estimated_duration, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ route: result.rows[0] });
  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({ error: 'Failed to update route' });
  }
};

// Deactivate a route
const deactivateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE routes SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deactivated', route: result.rows[0] });
  } catch (error) {
    console.error('Deactivate route error:', error);
    res.status(500).json({ error: 'Failed to deactivate route' });
  }
};

module.exports = { getAllRoutes, getRouteById, createRoute, updateRoute, deactivateRoute };

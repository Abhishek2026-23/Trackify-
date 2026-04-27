const pool = require('../config/database');

// Get all active buses
const getActiveBuses = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM active_trips_view ORDER BY route_number'
    );
    res.json({ trips: result.rows });
  } catch (error) {
    console.error('Get active buses error:', error);
    res.status(500).json({ error: 'Failed to fetch buses' });
  }
};

// Get bus details
const getBusById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM buses WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bus not found' });
    }
    
    res.json({ bus: result.rows[0] });
  } catch (error) {
    console.error('Get bus error:', error);
    res.status(500).json({ error: 'Failed to fetch bus' });
  }
};

module.exports = { getActiveBuses, getBusById };

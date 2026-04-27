const pool = require('../config/database');
const { getIO } = require('../socket');

// Create an alert
const createAlert = async (req, res) => {
  try {
    const { route_id, trip_id, alert_type, message, severity } = req.validatedData;

    const result = await pool.query(
      `INSERT INTO alerts (route_id, trip_id, alert_type, message, severity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [route_id || null, trip_id || null, alert_type, message, severity || 'info']
    );

    const alert = result.rows[0];

    // Broadcast to route room
    const io = getIO();
    if (route_id) io.to(`route:${route_id}`).emit('new_alert', alert);
    io.emit('new_alert', alert); // global broadcast

    res.status(201).json({ alert });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
};

// Resolve an alert
const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE alerts SET is_active = false, resolved_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });

    const alert = result.rows[0];
    const io = getIO();
    io.emit('alert_resolved', { id: alert.id });

    res.json({ alert });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
};

// Get active alerts
const getActiveAlerts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM alerts WHERE is_active = true
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC`
    );
    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

module.exports = { createAlert, resolveAlert, getActiveAlerts };

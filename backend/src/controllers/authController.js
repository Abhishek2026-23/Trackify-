const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '30');

// Generate a refresh token, store its hash in DB, return the raw token
async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(40).toString('hex');
  const hash = await bcrypt.hash(raw, 8);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hash, expiresAt]
  );
  return raw;
}

// User login
const login = async (req, res) => {
  try {
    const { phone, password } = req.validatedData;

    const result = await pool.query('SELECT * FROM users WHERE phone = $1 AND is_active = true', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '604800') }
    );

    const refreshToken = await createRefreshToken(user.id);

    // If driver, fetch driver profile
    let driverProfile = null;
    if (user.user_type === 'driver') {
      const dp = await pool.query('SELECT * FROM driver_profiles WHERE user_id = $1', [user.id]);
      if (dp.rows.length > 0) driverProfile = dp.rows[0];
    }

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        user_type: user.user_type,
        driverProfile,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// User registration
const register = async (req, res) => {
  try {
    const { name, phone, email, password, user_type, vehicle_type, vehicle_number } = req.validatedData;

    if (password.length < 8) {
      return res.status(422).json({ error: 'Validation failed', details: ['password: minimum 8 characters'] });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, phone, email, password_hash, user_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, phone, user_type',
      [name, phone, email || null, hashedPassword, user_type || 'commuter']
    );

    const user = result.rows[0];

    // Create driver profile if registering as driver
    if (user.user_type === 'driver') {
      if (!vehicle_type || !vehicle_number) {
        return res.status(422).json({ error: 'Validation failed', details: ['vehicle_type and vehicle_number required for drivers'] });
      }
      await pool.query(
        'INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number) VALUES ($1, $2, $3)',
        [user.id, vehicle_type, vehicle_number]
      );
    }

    res.status(201).json({ message: 'Registered successfully', user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Phone or email already registered' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Refresh access token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) return res.status(401).json({ error: 'Refresh token required' });

    // Find all non-revoked, non-expired tokens for comparison
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE revoked_at IS NULL AND expires_at > NOW()'
    );

    let matchedRow = null;
    for (const row of result.rows) {
      const match = await bcrypt.compare(rawToken, row.token_hash);
      if (match) { matchedRow = row; break; }
    }

    if (!matchedRow) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Revoke old token (rotation)
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [matchedRow.id]);

    // Get user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [matchedRow.user_id]);
    if (userResult.rows.length === 0) return res.status(401).json({ error: 'User not found' });
    const user = userResult.rows[0];

    // Issue new JWT and refresh token
    const newToken = jwt.sign(
      { id: user.id, phone: user.phone, user_type: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '604800') }
    );
    const newRefreshToken = await createRefreshToken(user.id);

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

// Logout — revoke refresh token
const logout = async (req, res) => {
  try {
    const { refreshToken: rawToken } = req.body;
    if (rawToken) {
      const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
        [req.user.id]
      );
      for (const row of result.rows) {
        const match = await bcrypt.compare(rawToken, row.token_hash);
        if (match) {
          await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [row.id]);
          break;
        }
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = { login, register, refreshToken, logout };

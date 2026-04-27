require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

async function test() {
  const r = await pool.query('SELECT phone, password_hash, is_active FROM users WHERE phone=$1', ['9999999999']);
  if (r.rows.length === 0) { console.log('User not found!'); process.exit(1); }
  const user = r.rows[0];
  console.log('User found:', user.phone, '| is_active:', user.is_active);
  console.log('Hash prefix:', user.password_hash.substring(0, 15));
  const match = await bcrypt.compare('admin123', user.password_hash);
  console.log('Password match:', match);
  process.exit(0);
}

test().catch(e => { console.error(e.message); process.exit(1); });

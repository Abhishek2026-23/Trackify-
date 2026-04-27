require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./src/config/database');

async function reset() {
  const hash = await bcrypt.hash('admin123', 10);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1",
    [hash]
  );
  console.log('Updated', result.rowCount, 'users — all passwords reset to admin123');
  process.exit(0);
}

reset().catch(e => { console.error(e.message); process.exit(1); });

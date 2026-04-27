const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting database migration...');

    // Startup connection check
    await Promise.race([
      client.query('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB connection timeout after 10s')), 10000)
      ),
    ]);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');

    console.log('✓ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();

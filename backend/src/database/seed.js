const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding database...');
    
    // 1. Seed Buses
    console.log('Seeding buses...');
    const busResult = await client.query(`
      INSERT INTO buses (bus_number, registration_number, capacity, bus_type, status)
      VALUES 
        ('PB-01', 'PB-10-A-1234', 40, 'standard', 'active'),
        ('PB-02', 'PB-10-B-5678', 40, 'standard', 'active'),
        ('PB-03', 'PB-10-C-9012', 50, 'ac', 'active'),
        ('PB-04', 'PB-10-D-3456', 40, 'standard', 'active'),
        ('PB-05', 'PB-10-E-7890', 35, 'electric', 'active')
      RETURNING id
    `);
    
    // 2. Seed Drivers
    console.log('Seeding drivers...');
    const driverResult = await client.query(`
      INSERT INTO drivers (name, phone, license_number, status)
      VALUES 
        ('Rajesh Kumar', '9876543210', 'DL-PB-2020-001234', 'active'),
        ('Suresh Singh', '9876543211', 'DL-PB-2019-005678', 'active'),
        ('Amit Sharma', '9876543212', 'DL-PB-2021-009012', 'active'),
        ('Vikram Patel', '9876543213', 'DL-PB-2020-003456', 'active'),
        ('Harpreet Kaur', '9876543214', 'DL-PB-2022-007890', 'active')
      RETURNING id
    `);
    
    // 3. Seed Routes
    console.log('Seeding routes...');
    const routeResult = await client.query(`
      INSERT INTO routes (route_number, route_name, start_point, end_point, total_distance, estimated_duration, is_active)
      VALUES 
        ('R-101', 'City Center to Railway Station', 'City Center', 'Railway Station', 12.5, 35, true),
        ('R-102', 'Bus Stand to University', 'Bus Stand', 'Punjab University', 8.3, 25, true),
        ('R-103', 'Airport to Mall Road', 'Airport', 'Mall Road', 15.7, 45, true)
      RETURNING id
    `);
    
    // 4. Seed Bus Stops for Route R-101
    console.log('Seeding bus stops...');
    const stopResult = await client.query(`
      INSERT INTO bus_stops (stop_name, stop_code, latitude, longitude, address, landmark)
      VALUES 
        ('City Center', 'CC-01', 30.7333, 76.7794, 'Sector 17, Chandigarh', 'Near Plaza'),
        ('Sector 22', 'S22-01', 30.7290, 76.7850, 'Sector 22, Chandigarh', 'Market Area'),
        ('ISBT 43', 'ISBT-43', 30.7200, 76.8000, 'Sector 43, Chandigarh', 'Bus Terminal'),
        ('Sector 35', 'S35-01', 30.7150, 76.8100, 'Sector 35, Chandigarh', 'Shopping Complex'),
        ('Railway Station', 'RS-01', 30.7050, 76.8200, 'Railway Station Road', 'Main Entrance'),
        
        ('Bus Stand', 'BS-01', 30.7400, 76.7700, 'Main Bus Stand', 'City Bus Stand'),
        ('Sector 14', 'S14-01', 30.7450, 76.7750, 'Sector 14, Chandigarh', 'Market'),
        ('Panjab University', 'PU-01', 30.7600, 76.7700, 'University Campus', 'Main Gate'),
        
        ('Airport', 'AP-01', 30.6735, 76.7885, 'Chandigarh Airport', 'Terminal'),
        ('Sector 8', 'S8-01', 30.7400, 76.7900, 'Sector 8, Chandigarh', 'Market'),
        ('Mall Road', 'MR-01', 30.7500, 76.8000, 'Mall Road', 'Shopping District')
      RETURNING id
    `);
    
    // 5. Map stops to routes
    console.log('Mapping stops to routes...');
    await client.query(`
      INSERT INTO route_stops (route_id, stop_id, stop_sequence, distance_from_start, estimated_time_from_start)
      VALUES 
        (1, 1, 1, 0, 0),
        (1, 2, 2, 2.5, 7),
        (1, 3, 3, 5.0, 14),
        (1, 4, 4, 8.5, 24),
        (1, 5, 5, 12.5, 35),
        
        (2, 6, 1, 0, 0),
        (2, 7, 2, 3.0, 10),
        (2, 8, 3, 8.3, 25),
        
        (3, 9, 1, 0, 0),
        (3, 10, 2, 7.5, 20),
        (3, 11, 3, 15.7, 45)
    `);
    
    // 6. Create active trips
    console.log('Creating active trips...');
    const now = new Date();
    const tripResult = await client.query(`
      INSERT INTO trips (bus_id, driver_id, route_id, trip_status, scheduled_start_time, actual_start_time, current_stop_id)
      VALUES 
        (1, 1, 1, 'active', $1, $1, 2),
        (2, 2, 2, 'active', $1, $1, 7),
        (3, 3, 3, 'scheduled', $2, NULL, NULL)
      RETURNING id
    `, [now, new Date(now.getTime() + 30 * 60000)]);
    
    // 7. Create admin user
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const userResult = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, user_type)
      VALUES 
        ('Admin User', 'admin@trackify.in', '9999999999', $1, 'admin'),
        ('Test Commuter', 'user@trackify.in', '8888888888', $1, 'commuter'),
        ('Rajesh Kumar', 'rajesh@trackify.in', '9876543210', $1, 'driver'),
        ('Suresh Singh', 'suresh@trackify.in', '9876543211', $1, 'driver'),
        ('Amit Sharma', 'amit@trackify.in', '9876543212', $1, 'driver'),
        ('Vikram Patel', 'vikram@trackify.in', '9876543213', $1, 'driver')
      ON CONFLICT (phone) DO NOTHING
      RETURNING id, phone, user_type
    `, [hashedPassword]);

    // 8. Create driver profiles for driver users
    console.log('Creating driver profiles...');
    const driverUsers = userResult.rows.filter(u => u.user_type === 'driver');
    const vehicleData = [
      { phone: '9876543210', vehicle_type: 'bus', vehicle_number: 'PB-01-2001' },
      { phone: '9876543211', vehicle_type: 'bus', vehicle_number: 'PB-01-2002' },
      { phone: '9876543212', vehicle_type: 'bus', vehicle_number: 'PB-01-2003' },
      { phone: '9876543213', vehicle_type: 'bus', vehicle_number: 'PB-01-2004' },
    ];
    for (const u of driverUsers) {
      const vd = vehicleData.find(v => v.phone === u.phone);
      if (vd) {
        await client.query(`
          INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number, is_available)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (user_id) DO NOTHING
        `, [u.id, vd.vehicle_type, vd.vehicle_number]);
      }
    }
    
    await client.query('COMMIT');
    console.log('✓ Database seeded successfully');
    
    console.log('\n=== Test Credentials ===');
    console.log('Admin:    phone=9999999999, password=admin123');
    console.log('Commuter: phone=8888888888, password=admin123');
    console.log('Driver 1: phone=9876543210, password=admin123');
    console.log('Driver 2: phone=9876543211, password=admin123');
    
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();

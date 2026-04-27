const Database = require('better-sqlite3');
const db = new Database('bus-tracking.db');

console.log('Creating database...');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS buses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_number TEXT UNIQUE NOT NULL,
    bus_type TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_number TEXT UNIQUE NOT NULL,
    route_name TEXT NOT NULL,
    start_point TEXT,
    end_point TEXT
  );

  CREATE TABLE IF NOT EXISTS bus_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stop_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER,
    route_id INTEGER,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (bus_id) REFERENCES buses(id),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER,
    latitude REAL,
    longitude REAL,
    speed REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id)
  );
`);

// Insert sample data
const insertBus = db.prepare('INSERT OR IGNORE INTO buses (bus_number, bus_type) VALUES (?, ?)');
insertBus.run('PB-01', 'standard');
insertBus.run('PB-02', 'standard');
insertBus.run('PB-03', 'ac');

const insertRoute = db.prepare('INSERT OR IGNORE INTO routes (route_number, route_name, start_point, end_point) VALUES (?, ?, ?, ?)');
insertRoute.run('R-101', 'City Center to Railway Station', 'City Center', 'Railway Station');

const insertStop = db.prepare('INSERT OR IGNORE INTO bus_stops (stop_name, latitude, longitude) VALUES (?, ?, ?)');
insertStop.run('City Center', 30.7333, 76.7794);
insertStop.run('Sector 22', 30.7290, 76.7850);
insertStop.run('Railway Station', 30.7050, 76.8200);

const insertTrip = db.prepare('INSERT OR IGNORE INTO trips (bus_id, route_id, status) VALUES (?, ?, ?)');
insertTrip.run(1, 1, 'active');

console.log('✓ Database initialized with sample data');
db.close();

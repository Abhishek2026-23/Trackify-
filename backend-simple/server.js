const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const Database = require('better-sqlite3');
const cors = require('cors');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const db = new Database('bus-tracking.db');
const PORT = 5000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// In-memory cache for live locations
const liveLocations = new Map();

// API Routes
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/routes', (req, res) => {
  const routes = db.prepare('SELECT * FROM routes').all();
  res.json({ routes });
});

app.get('/api/v1/buses/live', (req, res) => {
  const buses = db.prepare(`
    SELECT b.id as bus_id, b.bus_number, b.bus_type, t.route_id, r.route_number
    FROM buses b
    JOIN trips t ON b.id = t.bus_id
    JOIN routes r ON t.route_id = r.id
    WHERE t.status = 'active'
  `).all();

  const busesWithLocation = buses.map(bus => ({
    ...bus,
    location: liveLocations.get(bus.bus_id) || null
  }));

  res.json({ buses: busesWithLocation });
});

app.post('/api/v1/location/update', (req, res) => {
  const { bus_id, latitude, longitude, speed } = req.body;
  
  const locationData = {
    bus_id,
    latitude,
    longitude,
    speed: speed || 0,
    timestamp: new Date().toISOString()
  };

  // Store in cache
  liveLocations.set(bus_id, locationData);

  // Store in database
  db.prepare('INSERT INTO locations (bus_id, latitude, longitude, speed) VALUES (?, ?, ?, ?)')
    .run(bus_id, latitude, longitude, speed);

  // Broadcast to clients
  io.emit('bus_location_update', locationData);

  res.json({ success: true });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// GPS Simulator
const routeCoordinates = [
  { lat: 30.7333, lng: 76.7794 },
  { lat: 30.7320, lng: 76.7810 },
  { lat: 30.7290, lng: 76.7850 },
  { lat: 30.7200, lng: 76.8000 },
  { lat: 30.7050, lng: 76.8200 }
];

let currentIndex = 0;
setInterval(() => {
  const coord = routeCoordinates[currentIndex];
  const locationData = {
    bus_id: 1,
    latitude: coord.lat,
    longitude: coord.lng,
    speed: 35 + Math.random() * 10
  };

  liveLocations.set(1, { ...locationData, timestamp: new Date().toISOString() });
  io.emit('bus_location_update', locationData);
  
  currentIndex = (currentIndex + 1) % routeCoordinates.length;
}, 5000);

server.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log('✓ GPS Simulator active');
});

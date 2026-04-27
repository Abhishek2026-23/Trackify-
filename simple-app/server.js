const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Persistent storage (JSON file) ───────────────────────────────
const DB_FILE = path.join(__dirname, 'users-db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return { users: data.users || {}, drivers: data.drivers || {} };
    }
  } catch (e) { console.error('DB load error:', e.message); }
  return { users: {}, drivers: {} };
}

function saveDB() {
  try {
    const data = { users: Object.fromEntries(users), drivers: Object.fromEntries(drivers) };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('DB save error:', e.message); }
}

// ── Load persisted users ──────────────────────────────────────────
const dbData = loadDB();
const users = new Map(Object.entries(dbData.users));
const drivers = new Map(Object.entries(dbData.drivers));
const liveLocations = new Map();
const passengerLocations = new Map();

// ── Helpers ───────────────────────────────────────────────────────
const generateId = () => crypto.randomBytes(4).toString('hex').toUpperCase();

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ── Auth ──────────────────────────────────────────────────────────
app.post('/auth/register', (req, res) => {
  const { name, phone, email, password, role, vehicleType, vehicleNumber } = req.body;
  if (!name || !phone || !password || !role)
    return res.status(400).json({ error: 'Missing required fields' });
  if (users.has(phone))
    return res.status(409).json({ error: 'Phone already registered' });

  const userId = generateId();
  const user = { id: userId, name, phone, email, password, role };

  if (role === 'driver') {
    if (!vehicleType || !vehicleNumber)
      return res.status(400).json({ error: 'Vehicle info required for drivers' });
    const driverId = 'DRV-' + generateId();
    user.driverId = driverId;
    user.vehicleType = vehicleType;
    user.vehicleNumber = vehicleNumber;
    user.isAvailable = false;
    drivers.set(driverId, user);
  }

  users.set(phone, user);
  saveDB();
  const { password: _, ...safeUser } = user;
  res.status(201).json({ message: 'Registered successfully', user: safeUser });
});

app.post('/auth/login', (req, res) => {
  const { phone, driverId, password } = req.body;

  let user = null;
  if (driverId) {
    user = drivers.get(driverId);
  } else if (phone) {
    user = users.get(phone);
  }

  if (!user || user.password !== password)
    return res.status(401).json({ error: 'Invalid credentials' });

  const { password: _, ...safeUser } = user;
  res.json({ message: 'Login successful', user: safeUser, token: 'token-' + user.id });
});

// ── Location ──────────────────────────────────────────────────────
app.post('/location/update', (req, res) => {
  const { driverId, latitude, longitude, speed, isAvailable } = req.body;
  if (!driverId || latitude == null || longitude == null)
    return res.status(400).json({ error: 'Missing location data' });

  const driver = drivers.get(driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  if (isAvailable !== undefined) driver.isAvailable = isAvailable;

  const loc = { driverId, latitude, longitude, speed: speed || 0,
                vehicleType: driver.vehicleType, vehicleNumber: driver.vehicleNumber,
                driverName: driver.name, isAvailable: driver.isAvailable,
                timestamp: new Date().toISOString() };

  liveLocations.set(driverId, loc);
  io.emit('driver_location_update', loc);
  res.json({ success: true });
});

// ── Nearby drivers ────────────────────────────────────────────────
app.get('/drivers/nearby', (req, res) => {
  const { lat, lng, radius = 5, vehicleType } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const pLat = parseFloat(lat), pLng = parseFloat(lng), r = parseFloat(radius);
  const nearby = [];
  const now = Date.now();

  liveLocations.forEach((loc) => {
    if (!loc.isAvailable) return;
    if (vehicleType && loc.vehicleType !== vehicleType) return;
    // Skip stale locations older than 30 seconds
    if (now - new Date(loc.timestamp).getTime() > 30000) return;
    const dist = haversineKm(pLat, pLng, loc.latitude, loc.longitude);
    if (dist <= r) {
      const speed = loc.speed > 0 ? loc.speed : 30;
      nearby.push({ ...loc, distanceKm: parseFloat(dist.toFixed(2)),
                    etaMinutes: parseFloat((dist / speed * 60).toFixed(1)) });
    }
  });

  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  res.json({ drivers: nearby });
});

// ── Passenger location update ─────────────────────────────────────
app.post('/location/passenger', (req, res) => {
  const { userId, latitude, longitude } = req.body;
  if (!userId || latitude == null || longitude == null)
    return res.status(400).json({ error: 'Missing data' });
  const loc = { userId, latitude, longitude, timestamp: new Date().toISOString() };
  passengerLocations.set(userId, loc);
  io.emit('passenger_location_update', loc);
  res.json({ success: true });
});

// ── Passengers list (for drivers) ─────────────────────────────────
app.get('/passengers/live', (req, res) => {
  const list = [];
  passengerLocations.forEach((loc) => list.push(loc));
  res.json({ passengers: list });
});

// ── Location update — mark driver offline on logout ───────────────
app.post('/location/offline', (req, res) => {
  const { driverId } = req.body;
  if (driverId) liveLocations.delete(driverId);
  res.json({ success: true });
});

// ── Passenger go offline ──────────────────────────────────────────
app.post('/location/passenger/offline', (req, res) => {
  const userId = req.body && req.body.userId;
  if (userId) {
    passengerLocations.delete(userId);
    io.emit('passenger_offline', { userId });
  }
  res.json({ success: true });
});

// ── Clear all live locations ──────────────────────────────────────
app.post('/admin/clear-locations', (req, res) => {
  liveLocations.clear();
  res.json({ success: true });
});

app.get('/drivers/status/:driverId', (req, res) => {
  const driver = drivers.get(req.params.driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  const { password: _, ...safe } = driver;
  res.json({ driver: { ...safe, location: liveLocations.get(driver.driverId) || null } });
});

// ── WebSocket ─────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('driver_status_update', (data) => {
    const driver = drivers.get(data.driverId);
    if (driver) { driver.isAvailable = data.isAvailable; io.emit('driver_status_update', data); }
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ── Seed demo admin/passenger user (only if not already saved) ───
if (!users.has('9999999999')) {
  const demoUser = { id: 'DEMO0001', name: 'Demo Admin', phone: '9999999999', email: 'demo@bus.com', password: 'admin123', role: 'passenger' };
  users.set('9999999999', demoUser);
  saveDB();
}

// ── Seed demo drivers ─────────────────────────────────────────────
const seedDrivers = [
  { name: 'Gurpreet Singh', phone: '9876543210', vehicleType: 'bus', vehicleNumber: 'UP-78-1234', lat: 26.5834, lng: 80.1866 },
  { name: 'Harjinder Kaur', phone: '9876543211', vehicleType: 'bus', vehicleNumber: 'UP-78-5678', lat: 26.5814, lng: 80.1876 },
  { name: 'Manpreet Sharma', phone: '9876543212', vehicleType: 'bus', vehicleNumber: 'UP-78-9012', lat: 26.5844, lng: 80.1836 },
  { name: 'Balwinder Pal',  phone: '9876543213', vehicleType: 'bus', vehicleNumber: 'UP-78-3456', lat: 26.5804, lng: 80.1846 },
];

// Register seed drivers into memory (only if not already saved)
seedDrivers.forEach((d, i) => {
  const driverId = 'DRV-SEED0' + (i + 1);
  if (!drivers.has(driverId)) {
    const user = { id: 'SEED0' + (i + 1), name: d.name, phone: d.phone, password: 'demo123',
                   role: 'driver', driverId, vehicleType: d.vehicleType,
                   vehicleNumber: d.vehicleNumber, isAvailable: true };
    users.set(d.phone, user);
    drivers.set(driverId, user);
    saveDB();
  }
  const saved = drivers.get(driverId);
  liveLocations.set(driverId, { driverId, latitude: d.lat, longitude: d.lng, speed: 30,
    vehicleType: saved.vehicleType, vehicleNumber: saved.vehicleNumber, driverName: saved.name,
    isAvailable: true, timestamp: new Date().toISOString() });
});

// Simulate demo driver movement
let tick = 0;
setInterval(() => {
  tick++;
  liveLocations.forEach((loc, driverId) => {
    loc.latitude  += (Math.random() - 0.5) * 0.001;
    loc.longitude += (Math.random() - 0.5) * 0.001;
    loc.speed = 20 + Math.random() * 20;
    loc.timestamp = new Date().toISOString();
    io.emit('driver_location_update', loc);
  });
}, 5000);

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚌 Bus Tracking Backend Running`);
  console.log(`✓  http://localhost:${PORT}`);
  console.log(`✓  ${seedDrivers.length} demo drivers active`);
  console.log(`========================================\n`);
});

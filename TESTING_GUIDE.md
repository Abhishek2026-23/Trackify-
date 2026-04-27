# Testing Guide

## Setup Test Environment

### 1. Start Services
```bash
# Terminal 1: Start PostgreSQL and Redis
docker-compose up postgres redis

# Terminal 2: Start backend
cd backend
npm run dev

# Terminal 3: Start GPS simulator
cd backend
npm run simulate

# Terminal 4: Start web dashboard
cd web-dashboard
npm start
```

### 2. Verify Database
```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d bus_tracking

# Check data
SELECT * FROM buses;
SELECT * FROM routes;
SELECT * FROM trips WHERE trip_status = 'active';
```

### 3. Test APIs

**Health Check:**
```bash
curl http://localhost:5000/api/v1/health
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"9999999999","password":"admin123"}'
```

**Get Routes:**
```bash
curl http://localhost:5000/api/v1/routes
```

**Get Live Buses:**
```bash
curl http://localhost:5000/api/v1/buses/live
```

**Update Location:**
```bash
curl -X POST http://localhost:5000/api/v1/location/update \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": 1,
    "bus_id": 1,
    "latitude": 30.7333,
    "longitude": 76.7794,
    "speed": 35,
    "heading": 90,
    "accuracy": 5
  }'
```

### 4. Test WebSocket
Open browser console on `http://localhost:3000`:
```javascript
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('Connected'));
socket.emit('join_route', 1);
socket.on('bus_location_update', (data) => console.log(data));
```

### 5. Monitor Redis
```bash
redis-cli
> KEYS bus:location:*
> GET bus:location:1
> MONITOR
```

### 6. Test Mobile App
```bash
cd mobile-app
# Update API_URL in src/config.js to your IP
npm start
# Scan QR code with Expo Go app
```

## Load Testing

### Using Apache Bench
```bash
# Test location updates
ab -n 1000 -c 10 -p location.json -T application/json \
  http://localhost:5000/api/v1/location/update
```

### Using Artillery
```bash
npm install -g artillery

# Create artillery.yml
artillery quick --count 100 --num 10 \
  http://localhost:5000/api/v1/buses/live
```

## Expected Results
- Location update: <100ms
- API response: <200ms
- WebSocket latency: <50ms
- GPS simulator: Updates every 5 seconds
- Dashboard: Real-time bus movement on map

# API Documentation

Base URL: `http://localhost:5000/api/v1`

## Authentication

### POST /auth/login
Login with phone and password.

**Request:**
```json
{
  "phone": "9999999999",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "phone": "9999999999",
    "user_type": "admin"
  }
}
```

### POST /auth/register
Register new user.

**Request:**
```json
{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "password": "password123"
}
```

## Location APIs

### POST /location/update
Update bus GPS location (called by GPS device).

**Request:**
```json
{
  "trip_id": 1,
  "bus_id": 1,
  "latitude": 30.7333,
  "longitude": 76.7794,
  "speed": 35.5,
  "heading": 90,
  "accuracy": 5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location updated"
}
```

### GET /buses/live
Get live locations of all active buses.

**Query Parameters:**
- `route_id` (optional): Filter by route

**Response:**
```json
{
  "buses": [
    {
      "trip_id": 1,
      "bus_id": 1,
      "bus_number": "PB-01",
      "route_number": "R-101",
      "location": {
        "latitude": 30.7333,
        "longitude": 76.7794,
        "speed": 35.5,
        "timestamp": "2024-03-13T10:30:00Z"
      }
    }
  ]
}
```

## Route APIs

### GET /routes
Get all active routes.

**Response:**
```json
{
  "routes": [
    {
      "id": 1,
      "route_number": "R-101",
      "route_name": "City Center to Railway Station",
      "start_point": "City Center",
      "end_point": "Railway Station",
      "total_distance": 12.5,
      "estimated_duration": 35
    }
  ]
}
```

### GET /routes/:id
Get route details with stops.

**Response:**
```json
{
  "route": {
    "route_id": 1,
    "route_number": "R-101",
    "stops": [
      {
        "stop_id": 1,
        "stop_name": "City Center",
        "latitude": 30.7333,
        "longitude": 76.7794,
        "sequence": 1
      }
    ]
  }
}
```

## ETA APIs

### GET /stops/:id/eta
Calculate ETA for a stop.

**Query Parameters:**
- `trip_id` (required): Active trip ID

**Response:**
```json
{
  "stop_id": 5,
  "stop_name": "Railway Station",
  "distance_meters": 3500,
  "eta_minutes": 7,
  "current_speed": 30
}
```

## WebSocket Events

### Client → Server

**join_route**
```javascript
socket.emit('join_route', routeId);
```

**leave_route**
```javascript
socket.emit('leave_route', routeId);
```

### Server → Client

**bus_location_update**
```javascript
socket.on('bus_location_update', (data) => {
  // data: { trip_id, bus_id, latitude, longitude, speed, timestamp }
});
```

**bus_eta_update**
```javascript
socket.on('bus_eta_update', (data) => {
  // data: { trip_id, stop_id, eta_minutes }
});
```

**bus_delay_alert**
```javascript
socket.on('bus_delay_alert', (data) => {
  // data: { trip_id, message, delay_minutes }
});
```

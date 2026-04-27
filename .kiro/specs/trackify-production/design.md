# Design Document: Trackify Production

## Overview

Trackify Production evolves the existing `simple-app` demo into a production-ready transport tracking platform. The demo already works — it has real-time Socket.IO location broadcasting, a Leaflet map UI, driver/passenger roles, and a GPS simulator. The production system keeps all of that working while replacing the JSON file storage with PostgreSQL + Redis, adding proper JWT authentication, wiring up the scaffolded `backend/` folder, and making the `web-dashboard/` functional.

**What already exists and works:**
- `simple-app/` — fully functional demo (Node.js + Express + Socket.IO + Leaflet, JSON storage)
- `backend/` — scaffolded production backend with most controllers, middleware, config, and schema already written
- `backend/src/database/schema.sql` — complete PostgreSQL schema (buses, drivers, routes, trips, location_logs, users, alerts, user_favorites)
- `backend/src/config/redis.js` and `database.js` — connection pools already configured
- `backend/src/controllers/` — auth, location, bus, route, ETA controllers scaffolded
- `backend/src/middleware/auth.js` and `validator.js` — JWT auth and Joi validation scaffolded
- `web-dashboard/` — React + MUI app with Login, AdminDashboard, PassengerDashboard pages scaffolded
- `web-dashboard/src/services/socket.js` and `components/Map.jsx` — socket and map components scaffolded

**What needs to be built:**
1. Complete the backend controllers (missing fields, refresh tokens, driver profiles, trip management, alerts, nearby-driver query, health endpoint)
2. Add missing routes (trips, alerts, nearby drivers, health, metrics)
3. Wire the web-dashboard to the production backend (API service layer, config file)
4. Make the GPS simulator use the production API
5. Add Redis pub/sub for multi-instance Socket.IO (socket.io-adapter-redis)
6. Add location log rate-limiting (1 write per 10s per driver)
7. Add the cleanup job for old location logs
8. Add Prometheus metrics endpoint

The `simple-app` demo is left untouched throughout.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Clients                                  │
│  simple-app (demo)  │  web-dashboard  │  flutter-app            │
│  :5000              │  :3000          │  mobile                 │
└──────────┬──────────┴────────┬────────┴──────────┬──────────────┘
           │                  │                   │
           │         REST + WebSocket (Socket.IO)  │
           │                  │                   │
           └──────────────────▼───────────────────┘
                    ┌─────────────────┐
                    │  backend/       │
                    │  Node.js/Express│
                    │  :5001          │
                    └────┬──────┬────┘
                         │      │
              ┌──────────▼──┐  ┌▼──────────────┐
              │ PostgreSQL  │  │ Redis          │
              │ :5432       │  │ :6379          │
              │ persistent  │  │ live locations │
              │ storage     │  │ pub/sub        │
              └─────────────┘  └───────────────┘
```

The production backend runs on port **5001** to avoid conflicting with the demo on port 5000. The `simple-app` demo continues to run independently on port 5000 with its own JSON storage — it is never modified.

### Key Design Decisions

**Port separation**: Production backend on 5001, demo on 5000. The web-dashboard points to 5001.

**Redis for live state**: All live driver and passenger locations are stored in Redis with TTL. PostgreSQL is only written to for historical logs (rate-limited to 1 record per 10s per driver) and persistent data (users, routes, trips). This keeps the hot path fast.

**Async location logging**: Location log writes to PostgreSQL use `setImmediate` (already in the scaffolded `locationController.js`) so they never block the HTTP response.

**JWT + Refresh Token rotation**: Access tokens expire in 7 days, refresh tokens in 30 days. Refresh tokens are stored in a `refresh_tokens` table and invalidated on use (rotation). This table needs to be added to the schema.

**Socket.IO rooms**: Clients join `route:{routeId}` rooms. Location updates are broadcast to the relevant room. For multi-instance deployments, `@socket.io/redis-adapter` synchronizes events across instances.

**simple-app isolation**: The demo is never touched. It uses its own JSON file DB and runs on port 5000. The production system is a completely separate process.

---

## Components and Interfaces

### Backend Components

#### Auth Controller (`backend/src/controllers/authController.js`)
Currently scaffolded with `login` and `register`. Needs:
- `register`: add `user_type` field, driver profile creation (vehicle_type, vehicle_number), password min-length 8 enforcement
- `login`: return refresh token alongside JWT
- `refreshToken`: new handler — validate refresh token from DB, rotate it, return new JWT
- `logout`: invalidate refresh token

#### Location Controller (`backend/src/controllers/locationController.js`)
Currently scaffolded with `updateLocation` and `getLiveLocations`. Needs:
- `updateLocation`: add rate-limiting guard (check Redis for last-log timestamp before writing to PG), add driver availability flag, broadcast to `route:{routeId}` room
- `getLiveLocations`: already functional, minor cleanup
- `getNearbyDrivers`: new handler — query Redis for all `driver:location:*` keys, filter by haversine distance and availability, sort by distance, return with ETA
- `updatePassengerLocation`: new handler — store passenger location in Redis with 60s TTL
- `driverOffline` / `passengerOffline`: new handlers — delete Redis key, emit offline event

#### Trip Controller (`backend/src/controllers/tripController.js`)
New file. Handles:
- `startTrip`: create trip record, set status `active`, record actual_start_time
- `endTrip`: update trip status to `completed`, record actual_end_time
- `getActiveTrips`: return all active trips with bus/driver/route details (uses `active_trips_view`)
- `checkStaleTrips`: background job — find trips active > 12h with no location update, mark `stale`, create alert

#### Alert Controller (`backend/src/controllers/alertController.js`)
New file. Handles:
- `createAlert`: insert into `alerts` table, broadcast via Socket.IO to `route:{routeId}` room
- `resolveAlert`: set `resolved_at`, broadcast alert-resolved event
- `getActiveAlerts`: return alerts sorted by severity then created_at

#### ETA Controller (`backend/src/controllers/etaController.js`)
Currently scaffolded. Needs:
- Fallback speed when bus speed is 0 (use route's `estimated_duration` / `total_distance`)
- Dwell time per stop (configurable, default 1 min)
- Round result to nearest whole minute

#### Route Controller (`backend/src/controllers/routeController.js`)
Currently scaffolded with read operations. Needs:
- `createRoute`: operator-only, create route + route_stops
- `updateRoute`: operator-only
- `deactivateRoute`: set `is_active = false`

#### Validator Middleware (`backend/src/middleware/validator.js`)
Currently has schemas for `login`, `register`, `locationUpdate`. Needs:
- Update `register` schema: add `user_type`, `vehicle_type`, `vehicle_number` (conditional)
- Update `login` schema: password min 8 chars
- Add schemas for: `tripStart`, `createAlert`, `createRoute`, `passengerLocation`
- Return HTTP 422 (not 400) for validation errors

#### Auth Middleware (`backend/src/middleware/auth.js`)
Currently has `authenticateToken` and `requireAdmin`. Needs:
- `requireRole(...roles)`: generic role check returning 403 for unauthorized roles
- `requireOperator`: shorthand for admin or operator

#### Routes (`backend/src/routes/index.js`)
Currently has auth, location, route, bus, ETA routes. Needs:
- `POST /auth/refresh` — refresh token endpoint
- `POST /auth/logout` — invalidate refresh token
- `GET /drivers/nearby` — nearby driver query (public or passenger-auth)
- `POST /location/passenger` — passenger location update
- `POST /location/offline` — driver offline
- `POST /location/passenger/offline` — passenger offline
- `POST /trips` — start trip (driver-auth)
- `PUT /trips/:id/end` — end trip (driver-auth)
- `GET /trips/active` — active trips (operator/admin)
- `POST /routes` — create route (operator/admin)
- `PUT /routes/:id` — update route (operator/admin)
- `DELETE /routes/:id` — deactivate route (operator/admin)
- `GET /alerts` — get active alerts
- `POST /alerts` — create alert (operator/admin)
- `PUT /alerts/:id/resolve` — resolve alert (operator/admin)
- `GET /health` — health check (already exists, needs DB + Redis status)
- `GET /metrics` — Prometheus metrics

#### Socket Handler (`backend/src/socket/index.js`)
Currently scaffolded with `join_route` / `leave_route`. Needs:
- Log connection/disconnection with socket ID and client IP (structured JSON)
- Handle `driver_status_update` event (mirror from simple-app)
- Initialize Redis adapter for multi-instance support

### Database Additions

The existing `schema.sql` is complete for the core tables. Two additions are needed:

**`refresh_tokens` table** (new — not in schema.sql):
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

**`driver_profiles` table** (new — not in schema.sql):
```sql
CREATE TABLE IF NOT EXISTS driver_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    vehicle_type VARCHAR(30) NOT NULL,
    vehicle_number VARCHAR(50) NOT NULL,
    license_number VARCHAR(50),
    is_available BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_driver_profiles_user ON driver_profiles(user_id);
```

### Web Dashboard Components

The dashboard is scaffolded. What needs to be wired up:

**`web-dashboard/src/config.js`** (missing file — needs to be created):
```js
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
export const MAP_CONFIG = { center: [26.5824, 80.1856], zoom: 13 };
```

**`web-dashboard/src/services/api.js`** (missing file — needs to be created):
Axios instance with JWT interceptor, plus `busAPI`, `routeAPI`, `tripAPI`, `alertAPI` service objects.

**`LoginPage.jsx`**: Already functional. Minor fix: use `user_type` field for role selection (admin/operator vs commuter).

**`AdminDashboard.jsx`**: Already scaffolded. Needs:
- Fleet summary stats (active trips, online drivers, online passengers) — poll every 10s
- Alerts panel
- Route management (create/deactivate)

**`PassengerDashboard.jsx`**: Already scaffolded. Needs:
- Nearby buses panel (call `GET /drivers/nearby`)
- ETA display for nearest bus

### GPS Simulator

`backend/src/scripts/gps-simulator.js` needs to be updated to:
- Accept a route ID parameter
- Interpolate positions along route stops from PostgreSQL
- Send updates to `POST /api/v1/location/update` (production endpoint, port 5001)
- Support configurable bus count and interval

---

## Data Models

### Redis Key Schema

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `driver:location:{driverId}` | JSON location object | 30s | Live driver location |
| `passenger:location:{userId}` | JSON location object | 60s | Live passenger location |
| `location:last_log:{driverId}` | ISO timestamp | 10s | Rate-limit PG writes |

**Driver location object:**
```json
{
  "driver_id": 1,
  "user_id": 5,
  "trip_id": 12,
  "latitude": 26.5824,
  "longitude": 80.1856,
  "speed": 32.5,
  "heading": 180,
  "vehicle_type": "bus",
  "vehicle_number": "UP-78-1234",
  "driver_name": "Rajesh Kumar",
  "is_available": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### PostgreSQL Tables (existing schema.sql + additions)

Core tables already defined in `schema.sql`:
- `buses` — fleet master data
- `drivers` — driver records (name, phone, license)
- `routes` — route definitions
- `bus_stops` — stop locations
- `route_stops` — ordered stop-to-route mapping
- `trips` — active and historical trips
- `location_logs` — GPS history (rate-limited writes)
- `users` — all user accounts (commuter, admin, operator)
- `alerts` — system alerts
- `user_favorites` — saved routes/stops

New tables to add to schema:
- `refresh_tokens` — JWT refresh token rotation
- `driver_profiles` — vehicle info linked to user account

### API Response Shapes

**Auth login response:**
```json
{
  "token": "eyJ...",
  "refreshToken": "abc123...",
  "user": { "id": 1, "name": "Rajesh", "phone": "9876543210", "user_type": "driver" }
}
```

**Nearby drivers response:**
```json
{
  "drivers": [
    {
      "driver_id": 1,
      "driver_name": "Rajesh Kumar",
      "vehicle_number": "UP-78-1234",
      "vehicle_type": "bus",
      "speed": 32.5,
      "distance_km": 0.45,
      "eta_minutes": 2,
      "latitude": 26.5824,
      "longitude": 80.1856
    }
  ]
}
```

**Health check response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "redis": "connected"
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Password hash round-trip

*For any* valid registration payload with a plaintext password, the stored `password_hash` in PostgreSQL should pass `bcrypt.compare(plaintext, hash)` — i.e., registering then attempting login with the same password should always succeed.

**Validates: Requirements 1.1, 1.2**

### Property 2: Refresh token single-use (rotation)

*For any* valid refresh token, using it once to obtain a new JWT should succeed, and using the same token a second time should return HTTP 401 — the token is invalidated after first use.

**Validates: Requirements 1.5**

### Property 3: Protected endpoints reject missing JWT

*For any* protected API endpoint, a request sent without an `Authorization` header should always return HTTP 401, regardless of the endpoint or request body.

**Validates: Requirements 1.6**

### Property 4: Role-based access control

*For any* endpoint that requires role R, a request authenticated with a JWT for a user whose `user_type` is not R should always return HTTP 403.

**Validates: Requirements 1.7**

### Property 5: Password minimum length enforcement

*For any* registration request where the password field has fewer than 8 characters, the response should always be HTTP 422.

**Validates: Requirements 1.8**

### Property 6: Duplicate phone rejection

*For any* phone number that is already registered in the system, a second registration attempt with that phone number should always return HTTP 409.

**Validates: Requirements 1.10**

### Property 7: Driver location Redis TTL

*For any* valid driver location update, the Redis key `driver:location:{driverId}` should exist immediately after the update and have a TTL of at most 30 seconds.

**Validates: Requirements 2.1**

### Property 8: Available drivers appear in nearby results

*For any* driver marked as available with a valid Redis location within the query radius, that driver should appear in the nearby-drivers response.

**Validates: Requirements 2.3**

### Property 9: Location log rate limiting

*For any* driver sending multiple location updates within a 10-second window, the `location_logs` table should contain at most 1 new record for that driver within that window.

**Validates: Requirements 2.5**

### Property 10: Passenger location Redis TTL

*For any* valid passenger location update, the Redis key `passenger:location:{userId}` should exist immediately after the update and have a TTL of at most 60 seconds.

**Validates: Requirements 2.6**

### Property 11: Coordinate validation

*For any* location update request where latitude is outside [-90, 90] or longitude is outside [-180, 180], the response should always be HTTP 422.

**Validates: Requirements 2.8**

### Property 12: Nearby drivers within radius and sorted

*For any* set of driver locations and a query point with radius R, the nearby-drivers response should contain exactly the drivers whose haversine distance to the query point is ≤ R, sorted by ascending distance.

**Validates: Requirements 3.1, 3.2**

### Property 13: Nearby driver response completeness

*For any* driver returned in a nearby-drivers response, the result object should contain all required fields: `driver_name`, `vehicle_number`, `vehicle_type`, `speed`, `distance_km` (2 decimal places), and `eta_minutes`.

**Validates: Requirements 3.3**

### Property 14: Vehicle type filter

*For any* nearby-drivers query with a `vehicleType` filter, all returned drivers should have a `vehicle_type` matching the filter value.

**Validates: Requirements 3.6**

### Property 15: ETA is a whole number

*For any* ETA computation, the returned `eta_minutes` value should be a non-negative integer (no fractional minutes).

**Validates: Requirements 6.4**

### Property 16: Request body validation returns 422 with field details

*For any* POST or PUT request body that is missing required fields or contains values of the wrong type, the response should be HTTP 422 and the body should contain field-level error details.

**Validates: Requirements 11.3**

### Property 17: Migration idempotency

*For any* database state after running the migration script once, running the migration script a second time should produce an identical schema state without errors.

**Validates: Requirements 10.3**

### Property 18: GPS simulator position interpolation

*For any* simulated step along a route, the simulator's output position should lie between the coordinates of the current stop and the next stop in the route sequence.

**Validates: Requirements 12.2**

### Property 19: GPS simulator loop

*For any* route, after the GPS simulator advances past the last stop, the next emitted position should be at or near the first stop of the route (loop restart).

**Validates: Requirements 12.3**

---

## Error Handling

### HTTP Error Conventions

| Status | When |
|---|---|
| 400 | Malformed JSON body |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (duplicate phone, active trip already exists) |
| 415 | Wrong Content-Type on POST/PUT |
| 422 | Validation failure (field-level errors returned) |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error (no stack trace in production) |

### Error Response Shape

All errors follow a consistent shape:
```json
{
  "error": "Human-readable message",
  "details": ["field: specific issue"]  // only on 422
}
```

In `NODE_ENV=production`, the `error` field for 500 responses is always `"Internal server error"` — no stack traces.

### Startup Failure

If PostgreSQL or Redis cannot be reached within 10 seconds at startup, the server logs the error and exits with code 1. This is already partially implemented in `database.js` (the `pool.on('error')` handler calls `process.exit(-1)`). The startup check needs to be made explicit with a timeout.

### Unhandled Errors

The existing error handler middleware in `backend/src/middleware/errorHandler.js` needs to:
- Log the full stack trace at `error` level via Winston
- Return the sanitized response (no stack in production)
- Assign and include the request ID in the response

### Background Job Errors

The stale-trip checker and location-log cleanup job should catch and log errors without crashing the server. They run on a schedule (stale trips: every 30 min; log cleanup: daily).

---

## Testing Strategy

### Unit Tests (Jest)

Focus on pure logic that doesn't require a running database or Redis:

- **Haversine distance calculation** (`backend/src/utils/distance.js`) — verify correctness against known coordinates
- **ETA computation logic** — test the formula with various speed/distance/stop combinations
- **Validator schemas** — test each Joi schema with valid and invalid inputs
- **JWT signing/verification** — test token creation and expiry
- **Location log rate-limit guard** — test the Redis key check logic in isolation

### Property-Based Tests (Jest + fast-check)

Use [fast-check](https://github.com/dubzzz/fast-check) for property-based testing. Each property test runs a minimum of 100 iterations.

**Tag format:** `// Feature: trackify-production, Property {N}: {property_text}`

Properties to implement as property-based tests:

- **Property 1** — Generate random valid passwords, register, verify bcrypt round-trip
- **Property 2** — Generate random users, issue refresh token, use twice, verify second use fails
- **Property 3** — For each protected route, send request without auth header, verify 401
- **Property 4** — Generate users with various roles, test role-restricted endpoints, verify 403
- **Property 5** — Generate passwords of length 1–7, verify 422 on registration
- **Property 6** — Register a user, attempt to register again with same phone, verify 409
- **Property 7** — Send location updates, verify Redis TTL ≤ 30s
- **Property 9** — Send N updates in <10s, verify at most 1 PG log record
- **Property 11** — Generate out-of-range coordinates, verify 422
- **Property 12** — Generate random driver positions and query points, verify result set and ordering
- **Property 13** — Verify all required fields present in nearby-driver results
- **Property 14** — Generate mixed vehicle types, filter by type, verify all results match
- **Property 15** — Generate random ETA inputs, verify result is always a non-negative integer
- **Property 16** — Generate invalid request bodies, verify 422 with field details
- **Property 17** — Run migration twice, verify idempotency
- **Property 18** — Generate route steps, verify interpolated position is between stops
- **Property 19** — Advance simulator past last stop, verify restart at first stop

### Integration Tests

- Auth flow end-to-end (register → login → access protected endpoint → refresh → logout)
- Location update → Redis storage → WebSocket broadcast
- Trip lifecycle (start → location updates → end)
- Alert creation → WebSocket broadcast → resolution

### Manual / Smoke Tests

- `GET /api/v1/health` returns 200 with DB and Redis status
- GPS simulator runs and produces visible movement in the web dashboard
- simple-app demo still works independently on port 5000
- Web dashboard login, map display, and real-time updates work end-to-end

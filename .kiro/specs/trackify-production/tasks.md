# Tasks

## Phase 1: Database Foundation

- [x] 1.1 Add `refresh_tokens` and `driver_profiles` tables to `backend/src/database/schema.sql`
  - Add `refresh_tokens` table with `user_id`, `token_hash`, `expires_at`, `revoked_at` columns and indexes
  - Add `driver_profiles` table with `user_id`, `vehicle_type`, `vehicle_number`, `license_number`, `is_available` columns
  - Add `updated_at` trigger for `driver_profiles`

- [x] 1.2 Update `backend/src/database/migrate.js` to run idempotently
  - Wrap schema execution in a transaction
  - Ensure all `CREATE TABLE` statements use `IF NOT EXISTS` (already in schema.sql — verify)
  - Add explicit startup connection check: attempt `pool.query('SELECT 1')` with 10s timeout, exit(1) on failure

- [x] 1.3 Update `backend/src/database/seed.js` to seed driver profiles and refresh_tokens table
  - After seeding drivers table, insert corresponding `driver_profiles` rows for each driver user
  - Ensure seed is idempotent (use `ON CONFLICT DO NOTHING`)

## Phase 2: Auth Service

- [x] 2.1 Complete `backend/src/controllers/authController.js`
  - `register`: add `user_type` field, enforce password min 8 chars (return 422), create `driver_profiles` row when `user_type === 'driver'`, return 409 on duplicate phone
  - `login`: generate refresh token (crypto.randomBytes(32).toString('hex')), hash it with bcrypt, store in `refresh_tokens` table, return both JWT and `refreshToken` in response
  - Add `refreshToken` handler: look up token hash in DB, verify not expired/revoked, issue new JWT, rotate refresh token (revoke old, insert new)
  - Add `logout` handler: revoke refresh token by setting `revoked_at`

- [x] 2.2 Update `backend/src/middleware/validator.js`
  - Update `register` schema: password min 8 chars, add optional `user_type` (enum: commuter/driver/operator/admin), add conditional `vehicle_type` and `vehicle_number` for drivers
  - Update `login` schema: password min 8 chars
  - Add `refreshToken` schema: `{ refreshToken: Joi.string().required() }`
  - Change validation error status from 400 to 422
  - Add `passengerLocation`, `tripStart`, `createAlert`, `createRoute` schemas

- [x] 2.3 Update `backend/src/middleware/auth.js`
  - Add `requireRole(...roles)` middleware factory that returns 403 if `req.user.user_type` not in roles
  - Add `requireOperator` = `requireRole('admin', 'operator')`
  - Fix `authenticateToken`: return 401 (not 403) for missing token; keep 403 for invalid/expired token

- [x] 2.4 Add auth routes to `backend/src/routes/index.js`
  - `POST /auth/refresh` → `authController.refreshToken`
  - `POST /auth/logout` → `authenticateToken`, `authController.logout`

## Phase 3: Location Service

- [x] 3.1 Complete `backend/src/controllers/locationController.js`
  - `updateLocation`: change Redis key to `driver:location:{bus_id}`, add rate-limit guard (check `location:last_log:{bus_id}` key before PG write, set key with 10s TTL after write), broadcast to `route:{route_id}` room via `getIO()`
  - Add `getNearbyDrivers` handler: scan Redis keys `driver:location:*` using `redisClient.keys()`, parse each, compute haversine distance, filter by radius and `is_available`, sort ascending, return with ETA (distance/speed*60, fallback speed 30)
  - Add `updatePassengerLocation` handler: store `passenger:location:{userId}` in Redis with 60s TTL, broadcast `passenger_location_update` event
  - Add `driverOffline` handler: delete `driver:location:{driverId}` from Redis, emit `driver_offline` event to relevant route room
  - Add `passengerOffline` handler: delete `passenger:location:{userId}` from Redis, emit `passenger_offline` event

- [x] 3.2 Add location routes to `backend/src/routes/index.js`
  - `GET /drivers/nearby` → `locationController.getNearbyDrivers` (public)
  - `POST /location/passenger` → `authenticateToken`, `validate('passengerLocation')`, `locationController.updatePassengerLocation`
  - `POST /location/offline` → `locationController.driverOffline`
  - `POST /location/passenger/offline` → `locationController.passengerOffline`
  - `GET /buses/live` already exists — verify it works with new Redis key pattern

## Phase 4: Trip and Route Management

- [x] 4.1 Create `backend/src/controllers/tripController.js`
  - `startTrip`: validate driver has no active trip for same bus (return 409 if so), insert trip with `status='active'` and `actual_start_time=NOW()`, return trip record
  - `endTrip`: update trip `status='completed'`, set `actual_end_time=NOW()`
  - `getActiveTrips`: query `active_trips_view`, return with last known Redis location for each bus
  - Background stale-trip check: export `checkStaleTrips()` function — find trips active > 12h with no Redis location, set status `stale`, insert alert record

- [x] 4.2 Complete `backend/src/controllers/routeController.js`
  - Add `createRoute` handler: insert route + route_stops in a transaction, validate stop coordinates
  - Add `updateRoute` handler: update route fields
  - Add `deactivateRoute` handler: set `is_active = false`
  - Existing `getAllRoutes` and `getRouteById` are already functional — verify

- [x] 4.3 Create `backend/src/controllers/alertController.js`
  - `createAlert`: insert into `alerts` table, broadcast `new_alert` event to `route:{routeId}` Socket.IO room
  - `resolveAlert`: set `resolved_at = NOW()`, set `is_active = false`, broadcast `alert_resolved` event
  - `getActiveAlerts`: return alerts sorted by severity (critical first) then `created_at DESC`

- [x] 4.4 Add trip, route management, and alert routes to `backend/src/routes/index.js`
  - `POST /trips` → `authenticateToken`, `requireRole('driver')`, `validate('tripStart')`, `tripController.startTrip`
  - `PUT /trips/:id/end` → `authenticateToken`, `requireRole('driver')`, `tripController.endTrip`
  - `GET /trips/active` → `authenticateToken`, `requireOperator`, `tripController.getActiveTrips`
  - `POST /routes` → `authenticateToken`, `requireOperator`, `validate('createRoute')`, `routeController.createRoute`
  - `PUT /routes/:id` → `authenticateToken`, `requireOperator`, `routeController.updateRoute`
  - `DELETE /routes/:id` → `authenticateToken`, `requireOperator`, `routeController.deactivateRoute`
  - `GET /alerts` → `alertController.getActiveAlerts`
  - `POST /alerts` → `authenticateToken`, `requireOperator`, `validate('createAlert')`, `alertController.createAlert`
  - `PUT /alerts/:id/resolve` → `authenticateToken`, `requireOperator`, `alertController.resolveAlert`

## Phase 5: ETA Engine

- [ ] 5.1 Complete `backend/src/controllers/etaController.js`
  - Add fallback speed: when `location.speed === 0` or location unavailable, compute fallback as `route.total_distance / (route.estimated_duration / 60)` km/h
  - Add dwell time: count remaining stops between bus and destination stop, add `DWELL_TIME_MINUTES` (env var, default 1) per stop
  - Round final ETA to nearest whole minute using `Math.round()`
  - Return HTTP 404 with `"Bus is not in service"` when no active trip found for the bus

## Phase 6: Server Wiring and Infrastructure

- [x] 6.1 Update `backend/src/server.js`
  - Add explicit DB + Redis startup health check (attempt connection, exit(1) if fails within 10s)
  - Add `GET /api/v1/health` route that returns `{ status, timestamp, database, redis }`
  - Add `GET /metrics` endpoint (basic Prometheus-compatible text format: active connections, request count, error count)
  - Fix `CORS_ORIGIN` parsing to handle undefined gracefully (fallback to `'*'` in development)
  - Change server port to 5001 (add `PORT=5001` to `.env.example`)

- [ ] 6.2 Update `backend/src/socket/index.js`
  - Add `@socket.io/redis-adapter` initialization (conditional on `REDIS_ADAPTER=true` env var)
  - Add structured JSON logging for connect/disconnect events (socket ID + client IP)
  - Add `driver_status_update` event handler (mirror from simple-app for compatibility)

- [ ] 6.3 Update `backend/src/middleware/errorHandler.js`
  - Log full stack trace at `error` level via Winston logger
  - In production (`NODE_ENV=production`), return generic `"Internal server error"` message
  - Include `requestId` in error response (set by request ID middleware)

- [ ] 6.4 Add request ID middleware to `backend/src/server.js`
  - Generate UUID for each request, attach to `req.requestId`
  - Include `X-Request-ID` header in all responses
  - Pass `requestId` to Winston logger context

- [ ] 6.5 Add background jobs to `backend/src/server.js`
  - Schedule `checkStaleTrips()` every 30 minutes using `setInterval`
  - Schedule location log cleanup (delete records older than `LOG_RETENTION_DAYS` env var, default 90) daily at midnight

- [ ] 6.6 Update `backend/.env.example`
  - Add `PORT=5001`
  - Add `DWELL_TIME_MINUTES=1`
  - Add `LOG_RETENTION_DAYS=90`
  - Add `REDIS_ADAPTER=false`
  - Update `JWT_EXPIRES_IN=604800` (7 days in seconds)
  - Add `REFRESH_TOKEN_EXPIRES_DAYS=30`

## Phase 7: Web Dashboard Wiring

- [ ] 7.1 Create `web-dashboard/src/config.js`
  - Export `API_BASE_URL` (default `http://localhost:5001/api/v1`)
  - Export `SOCKET_URL` (default `http://localhost:5001`)
  - Export `MAP_CONFIG` with center coordinates and zoom level

- [ ] 7.2 Create `web-dashboard/src/services/api.js`
  - Create axios instance with `baseURL = API_BASE_URL`
  - Add request interceptor: attach `Authorization: Bearer {token}` from localStorage
  - Add response interceptor: on 401, attempt token refresh via `POST /auth/refresh`, retry original request; on second 401, redirect to login
  - Export `authAPI`: `{ login, register, refresh, logout }`
  - Export `busAPI`: `{ getLive, getById, getNearby }`
  - Export `routeAPI`: `{ getAll, getById, create, update, deactivate }`
  - Export `tripAPI`: `{ getActive, start, end }`
  - Export `alertAPI`: `{ getActive, create, resolve }`

- [ ] 7.3 Update `web-dashboard/src/pages/LoginPage.jsx`
  - Import `authAPI` from `../services/api` instead of using raw `fetch`
  - Add role selector for registration (commuter / driver / operator)
  - Add driver-specific fields (vehicle_type, vehicle_number) when driver role selected
  - Store both `token` and `refreshToken` in localStorage on login

- [ ] 7.4 Update `web-dashboard/src/pages/AdminDashboard.jsx`
  - Wire fleet summary stats to `GET /trips/active` (poll every 10s)
  - Add alerts panel: fetch from `GET /alerts`, display sorted by severity, add resolve button
  - Add route management panel: list routes, create route form, deactivate button
  - Ensure Socket.IO joins `route:{selectedRouteId}` room when a route is selected

- [ ] 7.5 Update `web-dashboard/src/pages/PassengerDashboard.jsx`
  - Add nearby buses panel: call `GET /drivers/nearby?lat=&lng=&radius=5` using browser geolocation
  - Display ETA for nearest bus prominently
  - Show offline banner when WebSocket disconnects, auto-reconnect

- [ ] 7.6 Update `web-dashboard/src/services/socket.js`
  - Pass JWT token in socket handshake auth: `io(SOCKET_URL, { auth: { token } })`
  - Add `onDriverOffline(callback)` and `onPassengerOffline(callback)` event handlers
  - Add `onAlert(callback)` event handler for `new_alert` events
  - Add reconnection logic with exponential backoff

## Phase 8: GPS Simulator Update

- [ ] 8.1 Update `backend/src/scripts/gps-simulator.js`
  - Accept `--route` (route ID), `--count` (number of buses, default 4), `--interval` (ms, default 5000) CLI args
  - On startup, fetch route stops from `GET /api/v1/routes/{routeId}` to get ordered stop coordinates
  - Interpolate bus position between stops based on elapsed time and configured speed (default 30 km/h)
  - When a bus reaches the last stop, restart from the first stop (loop)
  - Send updates to `POST /api/v1/location/update` with a valid driver JWT (use seeded driver credentials)
  - Support running multiple buses concurrently (one `setInterval` per bus)

## Phase 9: Testing

- [ ] 9.1 Set up Jest test infrastructure in `backend/`
  - Add `jest.config.js` with test environment `node`, coverage thresholds
  - Add `fast-check` dependency: `npm install --save-dev fast-check`
  - Create `backend/src/__tests__/` directory structure
  - Add test database setup/teardown helpers (use a separate `bus_tracking_test` DB)

- [ ] 9.2 Write unit tests for pure utility functions
  - `distance.js`: haversine calculation against known coordinate pairs
  - ETA formula: test with various speed/distance/stop count combinations
  - Validator schemas: test each schema with valid and boundary-invalid inputs

- [ ] 9.3 Write property-based tests (fast-check)
  - Property 1: Password hash round-trip — `fc.string({ minLength: 8 })` → register → login succeeds
  - Property 2: Refresh token single-use — use token twice, second use returns 401
  - Property 3: Protected endpoints reject missing JWT — for each protected route, no auth → 401
  - Property 4: Role-based access — wrong role → 403
  - Property 5: Password min length — `fc.string({ maxLength: 7 })` → register → 422
  - Property 6: Duplicate phone rejection — register twice with same phone → 409
  - Property 7: Driver location Redis TTL — update location → TTL ≤ 30s
  - Property 9: Location log rate limiting — N updates in <10s → at most 1 PG record
  - Property 11: Coordinate validation — out-of-range lat/lng → 422
  - Property 12: Nearby drivers within radius and sorted — generate random positions, verify result set and order
  - Property 13: Nearby driver response completeness — all required fields present
  - Property 14: Vehicle type filter — all results match filter
  - Property 15: ETA is a whole number — any input → integer result
  - Property 16: Request body validation → 422 with field details
  - Property 17: Migration idempotency — run migration twice → same schema
  - Property 18: GPS simulator interpolation — position between current and next stop
  - Property 19: GPS simulator loop — past last stop → restart at first stop

- [ ] 9.4 Write integration tests for key flows
  - Auth flow: register → login → access protected endpoint → refresh → logout
  - Location flow: update location → verify Redis key → verify WebSocket event
  - Trip lifecycle: start trip → send location updates → end trip

## Phase 10: Docker and Deployment

- [ ] 10.1 Verify and update `docker-compose.yml`
  - Ensure `api` service uses `backend/` directory, port 5001
  - Ensure `postgres` and `redis` services have health checks
  - Add `depends_on` with `condition: service_healthy` for the api service
  - Add volume for PostgreSQL data persistence

- [ ] 10.2 Verify `backend/Dockerfile`
  - Confirm it uses a non-root user
  - Confirm it uses a minimal Node.js base image (node:18-alpine or similar)
  - Add `EXPOSE 5001`

- [ ] 10.3 Create `.github/workflows/ci.yml`
  - Trigger on pull requests to `main`
  - Steps: checkout, install dependencies, run lint (`eslint`), run tests (`jest --runInBand`), build Docker image
  - Use `services:` to spin up PostgreSQL and Redis for integration tests

# Requirements Document

## Introduction

Trackify Production is the evolution of the existing Trackify demo into a production-ready, scalable transport tracking system. The current demo (`simple-app`) provides real-time location tracking via Socket.IO, a Leaflet-based map UI, JSON file storage, and a simulated GPS engine. The goal is to migrate this working foundation into a robust, multi-tenant platform with PostgreSQL persistence, Redis caching, JWT authentication, traffic-aware ETA, multi-client frontends (React web dashboard, React Native mobile app, Flutter app), and a cloud-deployable architecture with CI/CD.

The system is modular: each requirement maps to a discrete, independently deliverable component so the team can migrate incrementally without breaking the live demo.

---

## Glossary

- **System**: The Trackify Production platform as a whole.
- **API_Server**: The Node.js/Express (or Python FastAPI) backend that exposes REST and WebSocket endpoints.
- **Auth_Service**: The authentication and authorization subsystem within the API_Server.
- **Location_Service**: The subsystem responsible for ingesting, caching, and broadcasting GPS coordinates.
- **ETA_Engine**: The subsystem that computes estimated time of arrival for buses.
- **Notification_Service**: The subsystem that sends push and in-app alerts to users.
- **Admin_Dashboard**: The React + Material UI web application used by operators and administrators.
- **Passenger_App**: The React Native or Flutter mobile application used by passengers.
- **Driver_App**: The mobile application (Flutter) used by bus drivers to broadcast their location.
- **GPS_Simulator**: The script that generates synthetic GPS movement for testing and demo purposes.
- **PostgreSQL**: The primary relational database for persistent storage.
- **Redis**: The in-memory data store used for real-time location caching and pub/sub.
- **JWT**: JSON Web Token used for stateless authentication.
- **Route**: A defined path a bus travels, consisting of an ordered sequence of stops.
- **Trip**: A single scheduled or active run of a bus along a route.
- **Stop**: A named geographic point on a route where passengers board or alight.
- **Driver**: A registered user with role `driver` who operates a vehicle.
- **Passenger**: A registered user with role `passenger` who tracks buses.
- **Operator**: A registered user with role `operator` who manages routes, buses, and drivers.
- **Admin**: A registered user with role `admin` who has full system access.
- **ETA**: Estimated Time of Arrival, expressed in minutes.
- **Haversine_Distance**: The great-circle distance between two GPS coordinates.
- **PostGIS**: A PostgreSQL extension for native geospatial queries.
- **CI/CD**: Continuous Integration and Continuous Deployment pipeline.
- **Rate_Limiter**: Middleware that restricts the number of API requests per time window.
- **Refresh_Token**: A long-lived token used to obtain new JWTs without re-authentication.

---

## Requirements

### Requirement 1: User Authentication and Role Management

**User Story:** As a user (passenger, driver, operator, or admin), I want to register and log in securely, so that my identity is verified and I only access features appropriate to my role.

#### Acceptance Criteria

1. WHEN a new user submits a registration request with a valid name, phone number, email, password, and role, THE Auth_Service SHALL create a user record in PostgreSQL with the password stored as a bcrypt hash (minimum cost factor 10).
2. WHEN a user submits a login request with a valid phone and password, THE Auth_Service SHALL return a signed JWT (expiry 7 days) and a Refresh_Token (expiry 30 days).
3. WHEN a user submits a login request with an invalid phone or incorrect password, THE Auth_Service SHALL return HTTP 401 with a generic error message that does not reveal which field is wrong.
4. WHEN a JWT expires and the client submits a valid Refresh_Token, THE Auth_Service SHALL issue a new JWT without requiring the user to re-enter credentials.
5. WHEN a Refresh_Token is used, THE Auth_Service SHALL invalidate the previous Refresh_Token and issue a new one (token rotation).
6. WHEN a protected endpoint receives a request without a valid JWT, THE API_Server SHALL return HTTP 401.
7. WHEN a protected endpoint receives a request from a user whose role does not permit the action, THE API_Server SHALL return HTTP 403.
8. THE Auth_Service SHALL enforce a minimum password length of 8 characters and reject passwords that do not meet this constraint with HTTP 422.
9. WHEN a driver registers, THE Auth_Service SHALL also create a driver profile record linked to the user, storing vehicle type and vehicle registration number.
10. WHERE phone number uniqueness is required, THE Auth_Service SHALL reject duplicate phone registrations with HTTP 409.

---

### Requirement 2: Real-Time Location Ingestion and Broadcasting

**User Story:** As a driver, I want to broadcast my GPS coordinates continuously, so that passengers can see my live position on the map.

#### Acceptance Criteria

1. WHEN a driver sends a location update containing driver ID, latitude, longitude, speed, and heading, THE Location_Service SHALL store the update in Redis with a TTL of 30 seconds.
2. WHEN a location update is stored in Redis, THE Location_Service SHALL broadcast the update to all connected WebSocket clients subscribed to the relevant route room within 500 ms of receipt.
3. WHILE a driver is marked as available, THE Location_Service SHALL include that driver's location in responses to nearby-driver queries.
4. WHEN a driver's Redis entry expires (TTL elapsed with no update), THE Location_Service SHALL broadcast a `driver_offline` event to all clients subscribed to that driver's route room.
5. THE Location_Service SHALL persist location updates to the `location_logs` table in PostgreSQL at a maximum rate of one record per 10 seconds per driver, to limit write volume.
6. WHEN a passenger sends a location update containing user ID, latitude, and longitude, THE Location_Service SHALL store the update in Redis with a TTL of 60 seconds.
7. WHEN a passenger's Redis entry expires, THE Location_Service SHALL broadcast a `passenger_offline` event to subscribed drivers.
8. THE API_Server SHALL reject location update requests that contain latitude values outside the range −90 to 90 or longitude values outside the range −180 to 180 with HTTP 422.

---

### Requirement 3: Nearby Bus Discovery

**User Story:** As a passenger, I want to see buses within a configurable radius of my location, so that I can decide which bus to board.

#### Acceptance Criteria

1. WHEN a passenger queries nearby buses with a latitude, longitude, and radius (1–50 km), THE Location_Service SHALL return all available drivers whose cached Redis location falls within the specified radius, sorted by ascending Haversine_Distance.
2. WHEN computing nearby buses, THE Location_Service SHALL exclude drivers whose Redis TTL has expired (stale locations older than 30 seconds).
3. WHEN returning nearby bus results, THE Location_Service SHALL include for each bus: driver name, vehicle number, vehicle type, current speed, distance in km (2 decimal places), and ETA in minutes.
4. IF no buses are found within the requested radius, THEN THE Location_Service SHALL return an empty array with HTTP 200 (not an error).
5. THE Location_Service SHALL respond to nearby-bus queries within 200 ms under normal load (Redis cache hit path).
6. WHERE a vehicle type filter is provided in the query, THE Location_Service SHALL return only buses matching that vehicle type.

---

### Requirement 4: Route and Stop Management

**User Story:** As an operator, I want to define and manage bus routes with ordered stops, so that the system can provide accurate route-based tracking and ETA.

#### Acceptance Criteria

1. WHEN an operator creates a route with a route number, name, start point, end point, and an ordered list of stops, THE API_Server SHALL persist the route and all route-stop associations in PostgreSQL.
2. WHEN an operator adds a stop to a route, THE API_Server SHALL validate that the stop's latitude and longitude are valid coordinates before persisting.
3. WHEN a route is retrieved, THE API_Server SHALL return the full ordered list of stops including stop name, stop code, latitude, longitude, and distance from route start.
4. WHEN an operator deactivates a route, THE API_Server SHALL set `is_active = false` and exclude the route from passenger-facing queries.
5. THE API_Server SHALL return HTTP 404 when a client requests a route or stop that does not exist.
6. WHEN a route is deleted, THE API_Server SHALL cascade-delete all associated route-stop records.

---

### Requirement 5: Trip Lifecycle Management

**User Story:** As a driver, I want to start and end trips, so that the system can track which bus is running on which route at any given time.

#### Acceptance Criteria

1. WHEN a driver starts a trip by providing a bus ID and route ID, THE API_Server SHALL create a trip record with status `active` and record the actual start time.
2. WHEN a driver ends a trip, THE API_Server SHALL update the trip status to `completed` and record the actual end time.
3. WHILE a trip is active, THE Location_Service SHALL associate all incoming location updates from that driver with the active trip ID for logging.
4. WHEN a driver attempts to start a new trip while another trip is already active for the same bus, THE API_Server SHALL return HTTP 409.
5. THE API_Server SHALL return the list of all active trips to operators and admins, including bus number, driver name, route name, and last known location.
6. IF a trip has been in `active` status for more than 12 hours with no location update, THEN THE API_Server SHALL automatically set the trip status to `stale` and emit an alert.

---

### Requirement 6: ETA Computation

**User Story:** As a passenger, I want an accurate ETA for the next bus, so that I can plan my journey without waiting unnecessarily.

#### Acceptance Criteria

1. WHEN a passenger requests ETA for a specific bus and destination stop, THE ETA_Engine SHALL compute ETA using the bus's current speed, Haversine_Distance to the next stop, and remaining route distance.
2. WHEN the bus's current speed is 0 km/h or unavailable, THE ETA_Engine SHALL use the route's historical average speed for that time-of-day segment as the fallback speed.
3. WHEN computing ETA, THE ETA_Engine SHALL account for the number of remaining stops between the bus and the destination, applying a configurable dwell time per stop (default 1 minute).
4. THE ETA_Engine SHALL return ETA values rounded to the nearest whole minute.
5. WHEN ETA is requested for a bus that is not currently active, THE ETA_Engine SHALL return HTTP 404 with a message indicating the bus is not in service.
6. WHERE historical trip data for a route segment is available (minimum 10 prior trips), THE ETA_Engine SHALL blend the real-time speed-based estimate with the historical median travel time using a configurable weight (default: 60% real-time, 40% historical).

---

### Requirement 7: Admin and Operator Dashboard

**User Story:** As an admin or operator, I want a web dashboard to monitor the fleet, manage routes, and view system health, so that I can operate the service efficiently.

#### Acceptance Criteria

1. WHEN an admin logs into the Admin_Dashboard, THE Admin_Dashboard SHALL display a live map showing all active buses with their current positions, updated in real time via WebSocket.
2. WHEN an operator selects a route on the Admin_Dashboard, THE Admin_Dashboard SHALL highlight all stops on the map and show all buses currently running that route.
3. THE Admin_Dashboard SHALL display a fleet summary panel showing total buses, active trips, online drivers, and online passengers, refreshed every 10 seconds.
4. WHEN an admin views the alerts panel, THE Admin_Dashboard SHALL list all active system alerts sorted by severity (critical first) and creation time.
5. WHEN an operator creates, edits, or deactivates a route via the Admin_Dashboard, THE Admin_Dashboard SHALL call the corresponding API endpoint and reflect the change without a full page reload.
6. THE Admin_Dashboard SHALL be accessible only to users with role `admin` or `operator`; attempts to access it with other roles SHALL redirect to a 403 page.

---

### Requirement 8: Passenger and Driver Mobile Experience

**User Story:** As a passenger or driver using a mobile device, I want a responsive, native-quality app experience, so that I can track buses or broadcast my location on the go.

#### Acceptance Criteria

1. WHEN a passenger opens the Passenger_App and grants location permission, THE Passenger_App SHALL display nearby buses on a map within 3 seconds of the location being obtained.
2. WHEN a driver opens the Driver_App and goes online, THE Driver_App SHALL begin broadcasting GPS coordinates to the Location_Service at an interval of 5 seconds.
3. WHEN the Passenger_App loses network connectivity, THE Passenger_App SHALL display an offline banner and resume real-time updates automatically when connectivity is restored, without requiring a manual refresh.
4. WHEN the Driver_App loses network connectivity, THE Driver_App SHALL queue location updates locally and flush the queue to the Location_Service when connectivity is restored.
5. THE Passenger_App SHALL display ETA for the nearest bus on the main screen without requiring the passenger to navigate to a detail view.
6. WHEN a driver goes offline via the Driver_App, THE Driver_App SHALL send an offline signal to the Location_Service before closing the WebSocket connection.

---

### Requirement 9: Alerts and Notifications

**User Story:** As a passenger, I want to receive alerts about delays, route changes, or bus breakdowns, so that I can adjust my travel plans in time.

#### Acceptance Criteria

1. WHEN an operator creates an alert of type `delay`, `breakdown`, `route_change`, or `cancellation` for a route, THE Notification_Service SHALL broadcast the alert via WebSocket to all clients subscribed to that route room within 2 seconds.
2. WHEN an alert is created with severity `critical`, THE Notification_Service SHALL also send a push notification to all passengers who have favorited the affected route.
3. WHEN an operator resolves an alert, THE Notification_Service SHALL broadcast an alert-resolved event and update the alert record with a `resolved_at` timestamp.
4. THE Notification_Service SHALL store all alerts in the `alerts` table regardless of delivery outcome, for audit purposes.
5. IF a trip has been stationary for more than 10 minutes during active hours (06:00–22:00 local time), THEN THE Notification_Service SHALL automatically create a `delay` alert for the affected route.

---

### Requirement 10: Data Persistence and Database Migration

**User Story:** As a developer, I want a reliable database schema with migration tooling, so that schema changes can be applied safely across environments.

#### Acceptance Criteria

1. THE API_Server SHALL connect to PostgreSQL using a connection pool with a configurable minimum of 2 and maximum of 20 connections.
2. WHEN the API_Server starts, THE API_Server SHALL verify the database connection and log an error and exit with code 1 if the connection cannot be established within 10 seconds.
3. THE System SHALL provide a migration script that applies the full schema (tables, indexes, views, triggers) idempotently using `IF NOT EXISTS` guards.
4. THE System SHALL provide a seed script that populates the database with at least 3 routes, 10 stops, 4 buses, and 4 drivers for development and testing.
5. WHEN a location log record is inserted, THE System SHALL not block the main request thread; location logging SHALL be performed asynchronously.
6. THE System SHALL retain location log records for a configurable retention period (default 90 days) and provide a cleanup job that deletes records older than the retention period.

---

### Requirement 11: Security and API Hardening

**User Story:** As a system operator, I want the API to be hardened against common attacks, so that the production system is not easily compromised.

#### Acceptance Criteria

1. THE API_Server SHALL apply HTTP security headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, Content-Security-Policy) using the Helmet middleware on all responses.
2. THE API_Server SHALL enforce rate limiting of 100 requests per minute per IP on all `/api/` routes, returning HTTP 429 when the limit is exceeded.
3. THE API_Server SHALL validate and sanitize all incoming request bodies against a defined schema before passing data to controllers; invalid requests SHALL return HTTP 422 with field-level error details.
4. THE API_Server SHALL not expose stack traces or internal error messages in HTTP responses when `NODE_ENV` is set to `production`.
5. WHEN a JWT is signed, THE Auth_Service SHALL use an HMAC-SHA256 algorithm with a secret of at least 32 characters.
6. THE API_Server SHALL reject requests with a `Content-Type` other than `application/json` on all POST and PUT endpoints, returning HTTP 415.
7. THE System SHALL store all secrets (database credentials, JWT secret, Redis password) exclusively in environment variables and SHALL NOT commit them to version control.

---

### Requirement 12: GPS Simulation for Testing

**User Story:** As a developer, I want a GPS simulator that mimics realistic bus movement along defined routes, so that I can test the system without physical hardware.

#### Acceptance Criteria

1. WHEN the GPS_Simulator is started with a route ID, THE GPS_Simulator SHALL generate location updates for each simulated bus at a configurable interval (default 5 seconds).
2. WHEN generating a location update, THE GPS_Simulator SHALL interpolate the bus position along the route's stop sequence, advancing by a distance proportional to a configurable speed (default 30 km/h).
3. WHEN a simulated bus reaches the last stop on a route, THE GPS_Simulator SHALL restart the bus from the first stop to simulate a continuous loop.
4. THE GPS_Simulator SHALL send location updates to the Location_Service via the same REST endpoint used by real drivers, ensuring the simulator exercises the production code path.
5. THE GPS_Simulator SHALL support running multiple simulated buses concurrently, configurable via a count parameter (default 4).

---

### Requirement 13: Deployment and Scalability

**User Story:** As a DevOps engineer, I want the system to be containerized and deployable to a cloud environment with horizontal scaling, so that it can handle growing traffic without manual intervention.

#### Acceptance Criteria

1. THE System SHALL provide a `docker-compose.yml` that starts the API_Server, PostgreSQL, and Redis as separate services with health checks and dependency ordering.
2. THE API_Server SHALL be stateless with respect to in-process memory; all shared state (live locations, session data) SHALL be stored in Redis so that multiple API_Server instances can serve requests interchangeably.
3. WHEN the API_Server is deployed behind a load balancer with multiple instances, Socket.IO SHALL use the Redis adapter to synchronize events across all instances.
4. THE System SHALL provide a `Dockerfile` for the API_Server that produces an image based on a non-root user and a minimal Node.js base image.
5. THE System SHALL provide a CI/CD pipeline configuration (GitHub Actions or equivalent) that runs linting, unit tests, and builds the Docker image on every pull request to the main branch.
6. WHEN the API_Server receives a `GET /api/v1/health` request, THE API_Server SHALL return HTTP 200 with the current timestamp, database connection status, and Redis connection status.

---

### Requirement 14: Performance Monitoring and Logging

**User Story:** As an operator, I want structured logs and performance metrics, so that I can diagnose issues and understand system behavior in production.

#### Acceptance Criteria

1. THE API_Server SHALL emit structured JSON logs for every HTTP request, including method, path, status code, response time in milliseconds, and request ID.
2. THE API_Server SHALL emit structured JSON logs for every WebSocket connection and disconnection event, including socket ID and client IP.
3. WHEN an unhandled error occurs, THE API_Server SHALL log the full error stack trace at the `error` level and continue serving other requests.
4. THE System SHALL expose a `/metrics` endpoint compatible with Prometheus scraping, reporting at minimum: active WebSocket connections, HTTP request rate, HTTP error rate, and database pool utilization.
5. THE API_Server SHALL assign a unique request ID to every incoming HTTP request and include it in all log entries and error responses for that request, enabling end-to-end tracing.

-- Real-Time Bus Tracking System Database Schema
-- PostgreSQL 14+

-- Enable PostGIS extension for geospatial queries (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- TABLE: buses
-- Stores bus master data
-- ============================================
CREATE TABLE IF NOT EXISTS buses (
    id SERIAL PRIMARY KEY,
    bus_number VARCHAR(20) UNIQUE NOT NULL,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    bus_type VARCHAR(20) DEFAULT 'standard', -- standard, ac, electric
    status VARCHAR(20) DEFAULT 'active', -- active, maintenance, retired
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);
CREATE INDEX IF NOT EXISTS idx_buses_number ON buses(bus_number);

-- ============================================
-- TABLE: drivers
-- Stores driver information
-- ============================================
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, on_leave, inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- ============================================
-- TABLE: routes
-- Stores bus route definitions
-- ============================================
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    route_number VARCHAR(20) UNIQUE NOT NULL,
    route_name VARCHAR(100) NOT NULL,
    start_point VARCHAR(100) NOT NULL,
    end_point VARCHAR(100) NOT NULL,
    total_distance DECIMAL(10, 2), -- in kilometers
    estimated_duration INTEGER, -- in minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_routes_number ON routes(route_number);
CREATE INDEX IF NOT EXISTS idx_routes_active ON routes(is_active);

-- ============================================
-- TABLE: bus_stops
-- Stores bus stop locations
-- ============================================
CREATE TABLE IF NOT EXISTS bus_stops (
    id SERIAL PRIMARY KEY,
    stop_name VARCHAR(100) NOT NULL,
    stop_code VARCHAR(20) UNIQUE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    landmark VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stops_code ON bus_stops(stop_code);
CREATE INDEX IF NOT EXISTS idx_stops_location ON bus_stops(latitude, longitude);

-- ============================================
-- TABLE: route_stops
-- Maps stops to routes with sequence
-- ============================================
CREATE TABLE IF NOT EXISTS route_stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    stop_id INTEGER NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    distance_from_start DECIMAL(10, 2), -- in kilometers
    estimated_time_from_start INTEGER, -- in minutes
    UNIQUE(route_id, stop_sequence),
    UNIQUE(route_id, stop_id)
);

CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_sequence ON route_stops(route_id, stop_sequence);

-- ============================================
-- TABLE: trips
-- Stores active and scheduled bus trips
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    bus_id INTEGER NOT NULL REFERENCES buses(id),
    driver_id INTEGER NOT NULL REFERENCES drivers(id),
    route_id INTEGER NOT NULL REFERENCES routes(id),
    trip_status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    scheduled_start_time TIMESTAMP NOT NULL,
    actual_start_time TIMESTAMP,
    scheduled_end_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    current_stop_id INTEGER REFERENCES bus_stops(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(trip_status);
CREATE INDEX IF NOT EXISTS idx_trips_bus ON trips(bus_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_trips_active ON trips(trip_status, scheduled_start_time);

-- ============================================
-- TABLE: location_logs
-- Stores historical GPS location data
-- ============================================
CREATE TABLE IF NOT EXISTS location_logs (
    id BIGSERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    bus_id INTEGER NOT NULL REFERENCES buses(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2), -- in km/h
    heading INTEGER, -- 0-360 degrees
    accuracy DECIMAL(6, 2), -- in meters
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partition by date for better performance (optional)
CREATE INDEX IF NOT EXISTS idx_location_trip ON location_logs(trip_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location_bus ON location_logs(bus_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location_timestamp ON location_logs(timestamp DESC);

-- ============================================
-- TABLE: users
-- Stores commuter user accounts
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'commuter', -- commuter, admin, operator
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);

-- ============================================
-- TABLE: alerts
-- Stores system alerts and notifications
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id),
    route_id INTEGER REFERENCES routes(id),
    alert_type VARCHAR(30) NOT NULL, -- delay, breakdown, route_change, cancellation
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, critical
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_trip ON alerts(trip_id);

-- ============================================
-- TABLE: user_favorites
-- Stores user's favorite routes/stops
-- ============================================
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    stop_id INTEGER REFERENCES bus_stops(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, route_id, stop_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to all tables (drop first to allow idempotent re-run)
DROP TRIGGER IF EXISTS update_buses_updated_at ON buses;
CREATE TRIGGER update_buses_updated_at BEFORE UPDATE ON buses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_routes_updated_at ON routes;
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active trips with full details
CREATE OR REPLACE VIEW active_trips_view AS
SELECT 
    t.id as trip_id,
    t.trip_status,
    b.bus_number,
    b.bus_type,
    d.name as driver_name,
    d.phone as driver_phone,
    r.route_number,
    r.route_name,
    r.start_point,
    r.end_point,
    t.scheduled_start_time,
    t.actual_start_time,
    bs.stop_name as current_stop,
    t.updated_at
FROM trips t
JOIN buses b ON t.bus_id = b.id
JOIN drivers d ON t.driver_id = d.id
JOIN routes r ON t.route_id = r.id
LEFT JOIN bus_stops bs ON t.current_stop_id = bs.id
WHERE t.trip_status IN ('scheduled', 'active');

-- Route with stops
CREATE OR REPLACE VIEW route_details_view AS
SELECT 
    r.id as route_id,
    r.route_number,
    r.route_name,
    r.start_point,
    r.end_point,
    r.total_distance,
    r.estimated_duration,
    json_agg(
        json_build_object(
            'stop_id', bs.id,
            'stop_name', bs.stop_name,
            'stop_code', bs.stop_code,
            'latitude', bs.latitude,
            'longitude', bs.longitude,
            'sequence', rs.stop_sequence,
            'distance_from_start', rs.distance_from_start
        ) ORDER BY rs.stop_sequence
    ) as stops
FROM routes r
JOIN route_stops rs ON r.id = rs.route_id
JOIN bus_stops bs ON rs.stop_id = bs.id
WHERE r.is_active = true
GROUP BY r.id;

-- ============================================
-- TABLE: driver_profiles
-- Links user accounts to driver vehicle info
-- ============================================
CREATE TABLE IF NOT EXISTS driver_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    vehicle_type VARCHAR(30) NOT NULL DEFAULT 'bus',
    vehicle_number VARCHAR(50) NOT NULL,
    license_number VARCHAR(50),
    is_available BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_driver_profiles_user ON driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_available ON driver_profiles(is_available);

DROP TRIGGER IF EXISTS update_driver_profiles_updated_at ON driver_profiles;
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: refresh_tokens
-- JWT refresh token rotation store
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Comments for documentation
COMMENT ON TABLE buses IS 'Master data for all buses in the fleet';
COMMENT ON TABLE trips IS 'Active and historical trip records';
COMMENT ON TABLE location_logs IS 'GPS location history for analytics';
COMMENT ON TABLE users IS 'Commuter and admin user accounts';

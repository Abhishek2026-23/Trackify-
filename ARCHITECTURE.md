# System Architecture

## High-Level Architecture

```
┌─────────────────┐         ┌──────────────────┐
│  GPS Device     │────────>│   Backend API    │
│  (Bus Tracker)  │         │  Node.js+Express │
└─────────────────┘         └────────┬─────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
              │ PostgreSQL │   │   Redis   │   │ Socket.io │
              │  (Master)  │   │  (Cache)  │   │(Real-time)│
              └────────────┘   └───────────┘   └─────┬─────┘
                                                      │
                                    ┌─────────────────┼─────────────────┐
                                    │                 │                 │
                              ┌─────▼─────┐    ┌──────▼──────┐   ┌─────▼─────┐
                              │Web Dashboard│   │Mobile App   │   │Admin Panel│
                              │  (React)   │    │(React Native)│  │  (React)  │
                              └────────────┘    └─────────────┘   └───────────┘
```

## Data Flow

### 1. GPS Location Update Flow
```
Bus GPS Device → POST /api/location/update → Validate → Store in Redis → 
Broadcast via WebSocket → Update PostgreSQL (async)
```

### 2. User Query Flow
```
Mobile App → GET /api/buses/live → Check Redis Cache → 
Return cached data (if fresh) OR Query PostgreSQL → Cache result → Return
```

### 3. ETA Calculation Flow
```
User requests ETA → Calculate distance to stop → 
Factor in traffic (avg speed) → Return estimated time
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ (LTS)
- **Framework**: Express.js 4.x
- **Real-time**: Socket.io 4.x
- **Database**: PostgreSQL 14+ (JSONB support)
- **Cache**: Redis 7+ (Geospatial queries)
- **Validation**: Joi
- **Authentication**: JWT

### Frontend (Web Dashboard)
- **Framework**: React 18+
- **State Management**: Redux Toolkit
- **Maps**: Leaflet.js + React-Leaflet
- **UI**: Material-UI
- **HTTP Client**: Axios
- **WebSocket**: Socket.io-client

### Mobile App
- **Framework**: React Native 0.72+
- **Navigation**: React Navigation
- **Maps**: react-native-maps
- **State**: Redux Toolkit
- **Storage**: AsyncStorage

## Database Schema

### Core Tables
1. **buses** - Bus master data
2. **drivers** - Driver information
3. **routes** - Route definitions
4. **bus_stops** - Stop locations
5. **trips** - Active/scheduled trips
6. **location_logs** - Historical GPS data
7. **users** - Commuter accounts

## Low Bandwidth Optimization

### Strategies
1. **Delta Updates**: Send only changed coordinates
2. **Compression**: Gzip all API responses
3. **Caching**: Aggressive client-side caching
4. **Throttling**: Update location every 5-10 seconds
5. **Minimal Payload**: Remove unnecessary fields
6. **CDN**: Static assets via CDN

### Bandwidth Usage
- Location update: ~200 bytes
- Route data: ~5KB (cached)
- Map tiles: Cached locally
- Total per minute: ~2-3KB

## Scalability Considerations

### For 500+ Buses
1. **Horizontal Scaling**: Load balancer + multiple backend instances
2. **Redis Cluster**: Sharded cache for location data
3. **PostgreSQL Replication**: Read replicas for queries
4. **WebSocket Rooms**: Separate rooms per route
5. **Message Queue**: Bull/BullMQ for async processing
6. **Monitoring**: Prometheus + Grafana

### Performance Targets
- Location update latency: <100ms
- API response time: <200ms
- WebSocket broadcast: <50ms
- Support: 10,000 concurrent users
- Database queries: <50ms (indexed)

## Security

1. **API Authentication**: JWT tokens
2. **Rate Limiting**: 100 requests/minute per IP
3. **Input Validation**: Joi schemas
4. **SQL Injection**: Parameterized queries
5. **CORS**: Whitelist allowed origins
6. **HTTPS**: TLS 1.3 in production

## Deployment

### Docker Compose (Recommended)
```yaml
services:
  - backend (Node.js)
  - postgres
  - redis
  - nginx (reverse proxy)
```

### Cloud Options
- **AWS**: EC2 + RDS + ElastiCache
- **Azure**: App Service + PostgreSQL + Redis Cache
- **GCP**: Cloud Run + Cloud SQL + Memorystore
- **DigitalOcean**: Droplets + Managed Database

## Monitoring & Alerts

1. **Application Metrics**: Response times, error rates
2. **Infrastructure**: CPU, memory, disk usage
3. **Business Metrics**: Active buses, user sessions
4. **Alerts**: Slack/Email notifications for critical issues

# Scalability Strategy for 500+ Buses

## Current Architecture Capacity
- Single backend instance: ~100 buses
- PostgreSQL: ~1000 concurrent connections
- Redis: ~10,000 operations/second

## Scaling to 500+ Buses

### 1. Backend Horizontal Scaling
```
Load Balancer (Nginx/HAProxy)
    ├── Backend Instance 1
    ├── Backend Instance 2
    ├── Backend Instance 3
    └── Backend Instance N
```

**Implementation:**
- Use PM2 cluster mode or Docker Swarm
- Sticky sessions for WebSocket connections
- Health checks on `/api/v1/health`

### 2. Database Optimization

**PostgreSQL:**
- Master-Slave replication
- Read queries → Replicas
- Write queries → Master
- Connection pooling (max 20 per instance)

**Indexes:**
```sql
CREATE INDEX CONCURRENTLY idx_location_logs_bus_time 
ON location_logs(bus_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_trips_active 
ON trips(trip_status) WHERE trip_status = 'active';
```

### 3. Redis Cluster
- Sharding by bus_id
- 3 master nodes + 3 replicas
- Automatic failover

**Key Distribution:**
```
bus:location:{bus_id} → Shard by bus_id % 3
route:data:{route_id} → Shard by route_id % 3
```

### 4. WebSocket Optimization
- Socket.io Redis adapter for multi-instance
- Room-based broadcasting (per route)
- Reduce broadcast frequency to 3-5 seconds

### 5. Message Queue (Bull/BullMQ)
- Async location logging to PostgreSQL
- Alert processing
- Analytics computation

### 6. CDN & Caching
- Static assets → CloudFront/Cloudflare
- Route data → Cache for 1 hour
- Map tiles → Local cache

### 7. Monitoring & Alerts
- Prometheus + Grafana
- Alert on:
  - Response time > 500ms
  - Error rate > 1%
  - CPU > 80%
  - Memory > 85%

## Performance Targets
- Location update latency: <100ms
- API response time: <200ms
- WebSocket broadcast: <50ms
- Support: 10,000 concurrent users
- Database queries: <50ms

## Cost Estimation (AWS)
- EC2 (3x t3.medium): $75/month
- RDS PostgreSQL (db.t3.medium): $60/month
- ElastiCache Redis (cache.t3.medium): $50/month
- Load Balancer: $20/month
- Data Transfer: $30/month
**Total: ~$235/month for 500 buses**

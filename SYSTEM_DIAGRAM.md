# System Architecture Diagrams

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Web Dashboard   │  │   Mobile App     │  │  Admin Panel │ │
│  │   (React.js)     │  │ (React Native)   │  │   (React)    │ │
│  │                  │  │                  │  │              │ │
│  │  - Live Map      │  │  - Track Buses   │  │  - Monitor   │ │
│  │  - Route View    │  │  - View Routes   │  │  - Analytics │ │
│  │  - Real-time     │  │  - Get ETA       │  │  - Alerts    │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                    │          │
└───────────┼─────────────────────┼────────────────────┼──────────┘
            │                     │                    │
            └─────────────────────┼────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    Load Balancer (Nginx)  │
                    └─────────────┬─────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                        APPLICATION LAYER                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Node.js + Express Backend                        ││
│  │                                                               ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            ││
│  │  │   REST API │  │ WebSocket  │  │   Auth     │            ││
│  │  │            │  │ (Socket.io)│  │   (JWT)    │            ││
│  │  └────────────┘  └────────────┘  └────────────┘            ││
│  │                                                               ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐            ││
│  │  │ Location   │  │   Route    │  │    ETA     │            ││
│  │  │ Controller │  │ Controller │  │ Calculator │            ││
│  │  └────────────┘  └────────────┘  └────────────┘            ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                    │
└────────────────────────────┬───────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│   PostgreSQL   │  │     Redis       │  │  Message Queue │
│   (Database)   │  │    (Cache)      │  │   (Optional)   │
│                │  │                 │  │                │
│ - Buses        │  │ - Live Location │  │ - Async Tasks  │
│ - Routes       │  │ - Session Data  │  │ - Notifications│
│ - Trips        │  │ - Route Cache   │  │ - Analytics    │
│ - Locations    │  │ - TTL: 30s      │  │                │
└────────────────┘  └─────────────────┘  └────────────────┘
```

## Data Flow Diagram

### GPS Location Update Flow
```
┌──────────────┐
│  GPS Device  │
│  (on Bus)    │
└──────┬───────┘
       │ 1. Send GPS coordinates
       │    (lat, lng, speed, heading)
       ▼
┌──────────────────────────────────┐
│  POST /api/v1/location/update    │
│  Backend API Endpoint            │
└──────┬───────────────────────────┘
       │ 2. Validate data
       ▼
┌──────────────────────────────────┐
│  Store in Redis                  │
│  Key: bus:location:{bus_id}      │
│  TTL: 30 seconds                 │
└──────┬───────────────────────────┘
       │ 3. Cache stored
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ WebSocket    │  │  PostgreSQL      │
│ Broadcast    │  │  (Async Log)     │
│              │  │                  │
│ Emit to room │  │  INSERT INTO     │
│ route:{id}   │  │  location_logs   │
└──────┬───────┘  └──────────────────┘
       │ 4. Real-time update
       ▼
┌──────────────────────────────────┐
│  Connected Clients               │
│  - Web Dashboard                 │
│  - Mobile Apps                   │
│  - Admin Panel                   │
└──────────────────────────────────┘
```

### User Query Flow
```
┌──────────────┐
│  User/Client │
└──────┬───────┘
       │ 1. Request live buses
       ▼
┌──────────────────────────────────┐
│  GET /api/v1/buses/live          │
└──────┬───────────────────────────┘
       │ 2. Query active trips
       ▼
┌──────────────────────────────────┐
│  PostgreSQL                      │
│  SELECT * FROM trips             │
│  WHERE status = 'active'         │
└──────┬───────────────────────────┘
       │ 3. Get trip IDs
       ▼
┌──────────────────────────────────┐
│  Redis Cache Lookup              │
│  GET bus:location:{bus_id}       │
│  for each active bus             │
└──────┬───────────────────────────┘
       │ 4. Return cached locations
       ▼
┌──────────────────────────────────┐
│  Response to Client              │
│  {                               │
│    buses: [                      │
│      { bus_id, location, ... }   │
│    ]                             │
│  }                               │
└──────────────────────────────────┘
```

## WebSocket Communication

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Connect to Socket.io        │
       ├─────────────────────────────────>│
       │                                  │
       │  2. Connection established       │
       │<─────────────────────────────────┤
       │                                  │
       │  3. join_route(routeId)          │
       ├─────────────────────────────────>│
       │                                  │
       │  4. Joined room: route:{id}      │
       │<─────────────────────────────────┤
       │                                  │
       │                                  │ GPS Update
       │                                  │ Received
       │                                  │
       │  5. bus_location_update          │
       │<─────────────────────────────────┤
       │     { bus_id, lat, lng, ... }    │
       │                                  │
       │  6. bus_eta_update               │
       │<─────────────────────────────────┤
       │     { stop_id, eta_minutes }     │
       │                                  │
       │  7. leave_route(routeId)         │
       ├─────────────────────────────────>│
       │                                  │
       │  8. Left room                    │
       │<─────────────────────────────────┤
       │                                  │
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Load Balancer / Nginx                      │
│                   - SSL Termination                          │
│                   - Rate Limiting                            │
│                   - Static File Serving                      │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Backend     │ │  Backend     │ │  Backend     │
│  Instance 1  │ │  Instance 2  │ │  Instance 3  │
│  (Node.js)   │ │  (Node.js)   │ │  (Node.js)   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌─────────────┐
│ PostgreSQL   │ │   Redis     │ │   Logs      │
│   Master     │ │  Cluster    │ │ (CloudWatch)│
│              │ │             │ │             │
│  ┌────────┐  │ │ ┌─────────┐ │ └─────────────┘
│  │ Replica│  │ │ │ Node 1  │ │
│  └────────┘  │ │ │ Node 2  │ │
│              │ │ │ Node 3  │ │
└──────────────┘ └─┴─────────┴─┘
```

## Database Schema Relationships

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  buses   │       │ drivers  │       │  routes  │
│          │       │          │       │          │
│ id (PK)  │       │ id (PK)  │       │ id (PK)  │
│ bus_num  │       │ name     │       │ route_no │
│ capacity │       │ phone    │       │ distance │
└────┬─────┘       └────┬─────┘       └────┬─────┘
     │                  │                   │
     │                  │                   │
     └──────────┬───────┴───────┬───────────┘
                │               │
                ▼               ▼
         ┌──────────────────────────┐
         │        trips             │
         │                          │
         │ id (PK)                  │
         │ bus_id (FK)              │
         │ driver_id (FK)           │
         │ route_id (FK)            │
         │ trip_status              │
         │ current_stop_id (FK)     │
         └────┬─────────────────────┘
              │
              │
              ▼
       ┌──────────────┐
       │location_logs │
       │              │
       │ id (PK)      │
       │ trip_id (FK) │
       │ latitude     │
       │ longitude    │
       │ speed        │
       │ timestamp    │
       └──────────────┘

┌──────────┐       ┌──────────────┐       ┌──────────┐
│bus_stops │       │ route_stops  │       │  routes  │
│          │       │              │       │          │
│ id (PK)  │◄──────┤ stop_id (FK) │       │ id (PK)  │
│ name     │       │ route_id(FK) ├──────►│          │
│ latitude │       │ sequence     │       │          │
│ longitude│       │ distance     │       │          │
└──────────┘       └──────────────┘       └──────────┘
```

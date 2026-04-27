# Deployment Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional)

## Local Development Setup

### 1. Database Setup
```bash
# Start PostgreSQL and Redis
# Option A: Using Docker
docker-compose up -d postgres redis

# Option B: Local installation
# Install PostgreSQL and Redis on your system
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start server
npm run dev
```

### 3. Web Dashboard Setup
```bash
cd web-dashboard
npm install
npm start
```

### 4. Mobile App Setup
```bash
cd mobile-app
npm install
npm start
```

## Docker Deployment

### Full Stack with Docker Compose
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Production Deployment

### AWS Deployment
1. **EC2 Instance**: t3.medium or larger
2. **RDS PostgreSQL**: db.t3.micro or larger
3. **ElastiCache Redis**: cache.t3.micro or larger
4. **Load Balancer**: Application Load Balancer

### Environment Variables (Production)
```bash
NODE_ENV=production
PORT=5000
DB_HOST=your-rds-endpoint
DB_PASSWORD=strong-password
REDIS_HOST=your-elasticache-endpoint
JWT_SECRET=generate-strong-secret
CORS_ORIGIN=https://yourdomain.com
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location / {
        root /var/www/dashboard;
        try_files $uri /index.html;
    }
}
```

## Testing GPS Simulator
```bash
cd backend
npm run simulate
```

## Monitoring
- Application logs: `pm2 logs`
- Database: PostgreSQL slow query log
- Redis: `redis-cli monitor`

## Scaling for 500+ Buses
1. Horizontal scaling: Multiple backend instances
2. Redis Cluster: Sharded cache
3. PostgreSQL Read Replicas
4. CDN for static assets
5. Message Queue: Bull for async tasks

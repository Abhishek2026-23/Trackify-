# Quick Start Guide

## Prerequisites
Install these before starting:
- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- Redis 7+ ([Download](https://redis.io/download))

## 5-Minute Setup

### Step 1: Clone & Install
```bash
# Navigate to project
cd bus-tracking-system

# Install backend
cd backend
npm install

# Install web dashboard
cd ../web-dashboard
npm install
```

### Step 2: Configure Environment
```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your database credentials
```

### Step 3: Setup Database
```bash
cd backend
npm run db:migrate
npm run db:seed
```

### Step 4: Start Services
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start GPS simulator
cd backend
npm run simulate

# Terminal 3: Start dashboard
cd web-dashboard
npm start
```

### Step 5: Access Application
- Dashboard: http://localhost:3000
- API: http://localhost:5000/api/v1
- Health Check: http://localhost:5000/api/v1/health

## Test Credentials
- Phone: `9999999999`
- Password: `admin123`

## Verify Setup
1. Open dashboard at http://localhost:3000
2. You should see a map with Chandigarh area
3. GPS simulator will update bus location every 5 seconds
4. Watch the bus marker move on the map

## Troubleshooting
- **Database connection error**: Check PostgreSQL is running
- **Redis error**: Start Redis with `redis-server`
- **Port already in use**: Change PORT in .env
- **Map not loading**: Check internet connection for map tiles

## Next Steps
- Read `API_DOCUMENTATION.md` for API details
- See `DEPLOYMENT.md` for production setup
- Check `TESTING_GUIDE.md` for testing instructions

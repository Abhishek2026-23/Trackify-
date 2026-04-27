# Bus Tracking Backend

Node.js backend API with real-time WebSocket support.

## Features
- RESTful API
- WebSocket for real-time updates
- PostgreSQL database
- Redis caching
- JWT authentication
- GPS data validation

## Setup
```bash
npm install
cp .env.example .env
# Configure database credentials
npm run db:migrate
npm run db:seed
npm run dev
```

## Scripts
- `npm start`: Start production server
- `npm run dev`: Start development server
- `npm run db:migrate`: Run database migrations
- `npm run db:seed`: Seed database with test data
- `npm run simulate`: Run GPS simulator

## API Endpoints
See `API_DOCUMENTATION.md` for details.

## Technologies
- Node.js + Express
- Socket.io
- PostgreSQL
- Redis
- JWT

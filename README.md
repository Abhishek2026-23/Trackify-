# 🚌 Trackify — Real-Time Transport Tracking System

A production-ready real-time bus/transport tracking platform built with Node.js, PostgreSQL, Redis, and Flutter.

## Features
- 🔴 Live GPS tracking with WebSocket (Socket.IO)
- 👤 Driver & Passenger portals
- 🔐 JWT authentication with refresh token rotation
- 🗺️ Interactive maps with Leaflet
- 📱 Flutter mobile app (Android/iOS/Web)
- 🗄️ PostgreSQL database with Redis caching
- 📍 Nearby driver discovery with Haversine formula
- 🚨 Real-time alerts system

## Tech Stack
- **Backend:** Node.js, Express, Socket.IO, PostgreSQL, Redis
- **Mobile:** Flutter (Dart)
- **Web Dashboard:** React + Material UI
- **Maps:** Leaflet.js / flutter_map

## Quick Start
1. `cd backend && npm install`
2. Copy `.env.example` to `.env` and set your DB credentials
3. `npm run db:migrate && npm run db:seed`
4. `npm start` → runs on http://localhost:5001

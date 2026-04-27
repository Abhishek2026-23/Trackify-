# Bus Tracking Web Dashboard

Real-time bus tracking dashboard built with React and Leaflet.

## Features
- Live bus location tracking
- Interactive map with route visualization
- Real-time updates via WebSocket
- Route and bus filtering
- Responsive design

## Setup
```bash
npm install
cp .env.example .env
npm start
```

## Environment Variables
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_SOCKET_URL`: WebSocket server URL

## Build for Production
```bash
npm run build
```

## Technologies
- React 18
- Material-UI
- Leaflet
- Socket.io Client
- Axios

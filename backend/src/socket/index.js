const socketIO = require('socket.io');

let io;

const initializeSocket = (server) => {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['*'];

  io = socketIO(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Required for Render — trust the proxy
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join route room for real-time updates
    socket.on('join_route', (routeId) => {
      socket.join(`route:${routeId}`);
      console.log(`Socket ${socket.id} joined route:${routeId}`);
    });

    // Leave route room
    socket.on('leave_route', (routeId) => {
      socket.leave(`route:${routeId}`);
      console.log(`Socket ${socket.id} left route:${routeId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };

const socketIO = require('socket.io');

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
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

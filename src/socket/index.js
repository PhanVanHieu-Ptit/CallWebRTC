const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { CORS_ORIGIN, REDIS_URL } = require('../config');
const authenticateSocket = require('../middleware/auth');
const registerHandlers = require('./handlers');

const initSocket = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true
    },
    // For scalability, ensure sticky sessions are used if long-polling is enabled
    // or just force WebSockets
    transports: ['websocket', 'polling']
  });

  // Use Redis adapter if REDIS_URL is provided
  if (REDIS_URL) {
    try {
      const pubClient = createClient({ url: REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.io Redis adapter connected');
    } catch (err) {
      console.error('❌ Failed to connect to Redis for Socket.io adapter:', err.message);
      process.exit(1);
    }
  } else {
    console.warn('⚠️ No REDIS_URL provided. Scaling horizontally will not work.');
  }

  // Middleware
  io.use(authenticateSocket);

  // Connection handling
  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });

  return io;
};

module.exports = initSocket;

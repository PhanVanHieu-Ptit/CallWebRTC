const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { CORS_ORIGIN, REDIS_URL } = require('../config');
const authenticateSocket = require('../middleware/auth');
const registerHandlers = require('./handlers');
const roomService = require('./roomService');

/**
 * initialise the Socket.io server and attach it to the given http.Server.
 * @param {import('http').Server} httpServer
 * @returns {Promise<import('socket.io').Server>}
 */
const initSocket = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // WebSocket-only is preferred; polling is kept as fallback
    transports: ['websocket', 'polling'],
  });

  // ── Redis adapter (optional – enables horizontal scaling) ───────────────
  if (REDIS_URL) {
    try {
      const pubClient = createClient({ url: REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Socket.io Redis adapter connected');
    } catch (err) {
      console.error('❌ Failed to connect Redis adapter:', err.message);
      // Do NOT exit — service is still functional without the adapter
    }
  } else {
    console.warn('⚠️  No REDIS_URL — horizontal scaling disabled');
  }

  // ── JWT authentication middleware ───────────────────────────────────────
  io.use(authenticateSocket);

  // ── Connection ───────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    registerHandlers(io, socket);
  });

  // ── Expose roomService so external modules (e.g. REST webhook) can use it
  io.roomService = roomService;

  return io;
};

module.exports = initSocket;

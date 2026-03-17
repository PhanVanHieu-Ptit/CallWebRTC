const express = require('express');
const http = require('http');
const cors = require('cors');
const { CORS_ORIGIN, INTERNAL_API_KEY } = require('./config');
const initSocket = require('./socket');

const app = express();
const server = http.createServer(app);

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Internal API key middleware ───────────────────────────────────────────────
// Used by backend-api to push call events (call:incoming, call:accepted, etc.)
// into the signaling service without a WebSocket connection.
const requireInternalKey = (req, res, next) => {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

/**
 * POST /internal/notify-call
 *
 * Called by backend-api to push a call event to a specific user's socket.
 *
 * Body:
 *   {
 *     event: 'incoming-call' | 'call-accepted' | 'call-rejected' | 'call-ended',
 *     targetUserId: string,
 *     payload: Record<string, unknown>
 *   }
 */
app.post('/internal/notify-call', requireInternalKey, (req, res) => {
  const io = server.__io;
  if (!io) {
    return res.status(503).json({ error: 'Socket server not ready' });
  }

  const { event, targetUserId, payload } = req.body ?? {};

  if (!event || !targetUserId) {
    return res.status(400).json({ error: 'event and targetUserId are required' });
  }

  // Route to the personal room created for each authenticated user
  io.to(`user:${targetUserId}`).emit(event, payload ?? {});

  console.log(`[RTC internal] → ${event} to user:${targetUserId}`);
  res.status(200).json({ delivered: true });
});

// ── Start server ─────────────────────────────────────────────────────────────
const startServer = async (port) => {
  const io = await initSocket(server);

  // Expose io on the server instance so route handlers can access it
  server.__io = io;

  server.listen(port, () => {
    console.log(`🚀 [RTC] Signaling service running on port ${port}`);
  });
};

module.exports = { startServer };

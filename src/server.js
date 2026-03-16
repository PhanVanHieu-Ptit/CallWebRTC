const express = require('express');
const http = require('http');
const cors = require('cors');
const { CORS_ORIGIN } = require('./config');
const initSocket = require('./socket');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

const startServer = async (port) => {
  await initSocket(server);
  
  server.listen(port, () => {
    console.log(`🚀 Signaling service running on port ${port}`);
  });
};

module.exports = { startServer };

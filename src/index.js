const { PORT } = require('./config');
const { startServer } = require('./server');

startServer(PORT).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

require('dotenv').config();

module.exports = {
  PORT:             process.env.PORT || 4000,
  JWT_SECRET:       process.env.JWT_SECRET || 'change-me-in-production',
  REDIS_URL:        process.env.REDIS_URL,
  CORS_ORIGIN:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Shared secret for backend-api → rtc-service internal REST calls
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || 'internal-secret',
};

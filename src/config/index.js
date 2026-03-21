require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4000,
  // MUST match the JWT_SECRET used by backend-api (Telegram-mini) to sign tokens
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  REDIS_URL: process.env.REDIS_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  // Shared secret for backend-api → rtc-service internal REST calls
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || "internal-secret",
};

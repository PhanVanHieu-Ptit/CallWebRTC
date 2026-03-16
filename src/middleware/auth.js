const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    // Handling both "Bearer <token>" and raw token
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(tokenString, JWT_SECRET);
    
    // Attach user info to socket
    socket.user = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification failed:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = authenticateSocket;

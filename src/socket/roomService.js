/**
 * roomService — In-memory map of userId → Set<socketId>
 * Used to route call events to the correct socket without relying on socket rooms.
 */

/** @type {Map<string, Set<string>>} */
const userSockets = new Map();

const roomService = {
  /**
   * Register a socket for a user.
   * A user can have multiple sockets (tabs/devices).
   * @param {string} userId
   * @param {string} socketId
   */
  register(userId, socketId) {
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socketId);
  },

  /**
   * Remove a socket for a user on disconnect.
   * @param {string} userId
   * @param {string} socketId
   */
  unregister(userId, socketId) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(userId);
      }
    }
  },

  /**
   * Get the primary socket ID for a user (most recently connected).
   * @param {string} userId
   * @returns {string | undefined}
   */
  getSocketId(userId) {
    const sockets = userSockets.get(userId);
    if (!sockets || sockets.size === 0) return undefined;
    // Return the last registered socket (most recent)
    return [...sockets].at(-1);
  },

  /**
   * Get all socket IDs for a user.
   * @param {string} userId
   * @returns {string[]}
   */
  getAllSocketIds(userId) {
    const sockets = userSockets.get(userId);
    return sockets ? [...sockets] : [];
  },

  /**
   * Check if a user is currently connected.
   * @param {string} userId
   * @returns {boolean}
   */
  isOnline(userId) {
    const sockets = userSockets.get(userId);
    return !!(sockets && sockets.size > 0);
  },
};

module.exports = roomService;

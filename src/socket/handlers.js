const { JOIN_ROOM, LEAVE_ROOM, PEER_JOINED, PEER_LEFT, SIGNAL } = require('./events');

module.exports = (io, socket) => {
  console.log(`User connected: ${socket.user.id || socket.id} (Socket: ${socket.id})`);

  /**
   * join-room: Peer joins a room.
   * @param {string} roomId - The ID of the room to join.
   */
  socket.on(JOIN_ROOM, (roomId) => {
    if (!roomId) return;
    
    console.log(`Socket ${socket.id} joining room ${roomId}`);
    
    // Check existing participants in the room
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;

    // Join the room
    socket.join(roomId);
    socket.currentRoom = roomId;

    // Notify others in the room that a new peer has joined
    // We send the socket id of the new peer to existing peers
    socket.to(roomId).emit(PEER_JOINED, {
      peerId: socket.id,
      userId: socket.user.id
    });

    // Optionally: Send back a list of existing peers to the new participant
    // but in mesh WebRTC, usually the existing peers initiate the offer to the newcomer
  });

  /**
   * signal: Relays signaling data (SDP offer/answer or ICE candidate)
   * @param {Object} data 
   * @param {string} data.to - Socket ID of the recipient peer.
   * @param {Object} data.signal - WebRTC signaling data.
   */
  socket.on(SIGNAL, (data) => {
    const { to, signal } = data;
    
    console.log(`Relaying signal from ${socket.id} to ${to}`);
    
    // Relay the signal to the specific peer
    io.to(to).emit(SIGNAL, {
      from: socket.id,
      userId: socket.user.id,
      signal
    });
  });

  /**
   * leave-room: Peer leaves explicitly.
   */
  socket.on(LEAVE_ROOM, () => {
    const roomId = socket.currentRoom;
    if (roomId) {
      socket.leave(roomId);
      socket.to(roomId).emit(PEER_LEFT, { peerId: socket.id });
      delete socket.currentRoom;
    }
  });

  /**
   * disconnect: Handle socket disconnection.
   */
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomId = socket.currentRoom;
    if (roomId) {
      socket.to(roomId).emit(PEER_LEFT, { peerId: socket.id });
    }
  });
};

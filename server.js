'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Room state: roomId -> Set of socket IDs
const rooms = new Map();

// Helper: get users in a room (excluding the caller)
function getOtherUsersInRoom(roomId, currentSocketId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room].filter((id) => id !== currentSocketId);
}

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // ── Join room ────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, userName }) => {
    if (!roomId || typeof roomId !== 'string') return;
    const safeRoom = roomId.trim().slice(0, 64);
    const safeName = (userName || 'Anonymous').trim().slice(0, 32);

    socket.join(safeRoom);

    if (!rooms.has(safeRoom)) {
      rooms.set(safeRoom, new Set());
    }
    rooms.get(safeRoom).add(socket.id);

    // Tell the joining user who is already in the room
    const others = getOtherUsersInRoom(safeRoom, socket.id);
    socket.emit('room-users', { users: others });

    // Tell existing users about the newcomer
    socket.to(safeRoom).emit('user-joined', {
      socketId: socket.id,
      userName: safeName,
    });

    socket.data.roomId = safeRoom;
    socket.data.userName = safeName;
    console.log(`[>] ${safeName} (${socket.id}) joined room "${safeRoom}" (${rooms.get(safeRoom).size} users)`);
  });

  // ── WebRTC signaling ─────────────────────────────────────────────────────
  socket.on('offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('offer', {
      from: socket.id,
      sdp,
    });
  });

  socket.on('answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('answer', {
      from: socket.id,
      sdp,
    });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', {
      from: socket.id,
      candidate,
    });
  });

  // ── Media state changes ──────────────────────────────────────────────────
  socket.on('media-state', ({ audio, video }) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('peer-media-state', {
        socketId: socket.id,
        audio: !!audio,
        video: !!video,
      });
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnecting', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      console.log(`[-] ${socket.data.userName || socket.id} left room "${roomId}"`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀  CallWebRTC server running at http://localhost:${PORT}\n`);
});

module.exports = { app, server };

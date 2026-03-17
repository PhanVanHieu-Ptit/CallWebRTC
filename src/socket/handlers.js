/**
 * handlers.js — Core Socket.io event handlers for the WebRTC signaling service.
 *
 * Event flow:
 *
 *  Caller                    rtc-service                 Callee
 *  ───────                   ──────────                  ──────
 *  start-call ─────────────► route to callee ──────────► incoming-call (with offer)
 *                            (joined same room)
 *  ◄─────────────────────── call-answered ◄────────────── accept-call (with answer)
 *  ice-candidate ──────────► route to other peer ────────► ice-candidate
 *  end-call ───────────────► notify remote ─────────────► call-ended
 *
 *  Callee can also:
 *  reject-call ────────────► notify caller ─────────────► call-rejected
 */

const {
  JOIN_ROOM,
  LEAVE_ROOM,
  PEER_JOINED,
  PEER_LEFT,
  START_CALL,
  ACCEPT_CALL,
  REJECT_CALL,
  END_CALL,
  INCOMING_CALL,
  CALL_ANSWERED,
  CALL_REJECTED,
  CALL_ENDED,
  CALL_ERROR,
  ICE_CANDIDATE,
  SIGNAL,
  MEDIA_TOGGLE,
  MEDIA_STATE,
} = require("./events");

const roomService = require("./roomService");

/**
 * Register all socket event handlers.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
module.exports = (io, socket) => {
  // The userId is set by the JWT auth middleware
  const userId = socket.user?.id || socket.user?.sub || socket.user?.userId;

  if (!userId) {
    console.error(
      `[RTC] Connected socket ${socket.id} has no userId — disconnecting`,
    );
    socket.disconnect(true);
    return;
  }

  console.log(`[RTC] User connected: ${userId} (socket: ${socket.id})`);

  // Register this socket for the user (supports multiple devices)
  roomService.register(userId, socket.id);

  // Join a personal room so backend / rtc-service can send targeted notifications
  socket.join(`user:${userId}`);

  // ── Generic room management (for mesh group calls) ──────────────────────

  socket.on(JOIN_ROOM, (payload) => {
    const roomId = typeof payload === "string" ? payload : payload?.roomId;
    if (!roomId) return;
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.to(roomId).emit(PEER_JOINED, { peerId: socket.id, userId });
    console.log(`[RTC] ${userId} joined room ${roomId}`);
  });

  socket.on(LEAVE_ROOM, () => {
    const roomId = socket.currentRoom;
    if (roomId) {
      socket.leave(roomId);
      socket.to(roomId).emit(PEER_LEFT, { peerId: socket.id, userId });
      delete socket.currentRoom;
    }
  });

  // ── Call initiation ─────────────────────────────────────────────────────
  /**
   * Emitted by the CALLER.
   * Payload: { targetUserId, roomId, callerName, offer: RTCSessionDescriptionInit }
   *
   * 1. Caller joins the call room.
   * 2. We look up the callee's socket ID.
   * 3. We forward the offer to the callee as 'incoming-call'.
   */
  socket.on(START_CALL, (payload) => {
    const { targetUserId, roomId, callerName, offer } = payload ?? {};

    if (!targetUserId || !roomId || !offer) {
      socket.emit(CALL_ERROR, {
        code: "INVALID_PAYLOAD",
        message: "targetUserId, roomId and offer are required",
      });
      return;
    }

    console.log(
      `[RTC] ${userId} → start-call → ${targetUserId} (room: ${roomId})`,
    );

    // Caller joins their own room
    socket.join(roomId);
    socket.currentRoom = roomId;

    // Find callee socket
    const calleeSocketId = roomService.getSocketId(targetUserId);
    if (!calleeSocketId) {
      socket.emit(CALL_ERROR, {
        code: "USER_OFFLINE",
        message: "The user you are calling is offline",
      });
      return;
    }

    // Forward to callee
    io.to(calleeSocketId).emit(INCOMING_CALL, {
      callId: payload.callId,
      callerId: userId,
      callerName: callerName || userId,
      roomId,
      offer,
      callType: payload.callType ?? "video",
    });

    // Auto-timeout: if callee doesn't answer within 30s, notify caller
    const timeout = setTimeout(() => {
      const calleeStillOffline = !io.sockets.adapter.rooms
        .get(roomId)
        ?.has(calleeSocketId);
      if (calleeStillOffline) {
        socket.emit(CALL_REJECTED, { reason: "timeout" });
        io.to(calleeSocketId).emit(CALL_ENDED, {
          endedBy: "system",
          reason: "timeout",
        });
      }
    }, 30_000);

    // Clear timeout if callee joins the room (accepts)
    socket._callTimeout = timeout;
  });

  // ── Call acceptance ─────────────────────────────────────────────────────
  /**
   * Emitted by the CALLEE.
   * Payload: { callerId, roomId, answer: RTCSessionDescriptionInit }
   *
   * 1. Callee joins the call room to receive trickle ICE.
   * 2. Forward the answer to the caller as 'call-answered'.
   */
  socket.on(ACCEPT_CALL, async (payload) => {
    const { callerId, roomId, answer } = payload ?? {};

    if (!callerId || !roomId || !answer) {
      socket.emit(CALL_ERROR, {
        code: "INVALID_PAYLOAD",
        message: "callerId, roomId and answer are required",
      });
      return;
    }

    console.log(`[RTC] ${userId} → accept-call (room: ${roomId})`);

    // Callee joins the room
    socket.join(roomId);
    socket.currentRoom = roomId;

    // Forward answer to caller
    const callerSocketId = roomService.getSocketId(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit(CALL_ANSWERED, { answer });

      // Clear call timeout since callee answered
      const callerSocket = io.sockets.sockets.get(callerSocketId);
      if (callerSocket?._callTimeout) {
        clearTimeout(callerSocket._callTimeout);
        delete callerSocket._callTimeout;
      }
    }
  });

  // ── Call rejection ──────────────────────────────────────────────────────
  /**
   * Emitted by the CALLEE who doesn't want to answer.
   * Payload: { callerId, roomId }
   */
  socket.on(REJECT_CALL, (payload) => {
    const { callerId, roomId } = payload ?? {};

    if (!callerId || !roomId) return;

    console.log(`[RTC] ${userId} → reject-call (caller: ${callerId})`);

    const callerSocketId = roomService.getSocketId(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit(CALL_REJECTED, { reason: "declined" });

      // Clear call timeout since callee responded
      const callerSocket = io.sockets.sockets.get(callerSocketId);
      if (callerSocket?._callTimeout) {
        clearTimeout(callerSocket._callTimeout);
        delete callerSocket._callTimeout;
      }
    }
  });

  // ── Call termination ────────────────────────────────────────────────────
  /**
   * Emitted by either party to end the call.
   * Payload: { roomId }
   */
  socket.on(END_CALL, (payload) => {
    const { roomId } = payload ?? {};

    if (!roomId) return;

    console.log(`[RTC] ${userId} → end-call (room: ${roomId})`);

    // Notify all other participants in the room
    socket.to(roomId).emit(CALL_ENDED, { endedBy: userId });

    // Leave the room
    socket.leave(roomId);
    if (socket.currentRoom === roomId) {
      delete socket.currentRoom;
    }
  });

  // ── ICE candidate trickle ───────────────────────────────────────────────
  /**
   * Relay ICE candidates within the call room.
   * Payload: { roomId, candidate: RTCIceCandidateInit }
   */
  socket.on(ICE_CANDIDATE, (payload) => {
    const { roomId, candidate } = payload ?? {};

    if (!roomId || !candidate) return;

    // Broadcast to everyone else in the room
    socket.to(roomId).emit(ICE_CANDIDATE, { candidate });
  });

  // ── Generic relay signal (for mesh or custom signaling) ─────────────────
  socket.on(SIGNAL, (data) => {
    const { to, signal } = data ?? {};
    if (!to || !signal) return;
    io.to(to).emit(SIGNAL, { from: socket.id, userId, signal });
  });

  // ── Media state toggle ──────────────────────────────────────────────────
  /**
   * Payload: { roomId, kind: 'audio'|'video', enabled: boolean }
   */
  socket.on(MEDIA_TOGGLE, (payload) => {
    const { roomId, kind, enabled } = payload ?? {};
    if (!roomId) return;
    socket.to(roomId).emit(MEDIA_STATE, { userId, kind, enabled });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[RTC] ${userId} disconnected (${reason})`);

    // Clear any pending call timeout
    if (socket._callTimeout) {
      clearTimeout(socket._callTimeout);
      delete socket._callTimeout;
    }

    // Unregister from user→socket map
    roomService.unregister(userId, socket.id);

    // Notify call room participants if user was in a room
    const roomId = socket.currentRoom;
    if (roomId) {
      socket.to(roomId).emit(CALL_ENDED, { endedBy: userId });
      socket.to(roomId).emit(PEER_LEFT, { peerId: socket.id, userId });
    }
  });
};

/**
 * Socket event name constants — single source of truth.
 * Shared between handlers and tests.
 */
module.exports = {
  // ── Room management (generic) ───────────────────────────────────────────
  JOIN_ROOM:   'join-room',
  LEAVE_ROOM:  'leave-room',
  PEER_JOINED: 'peer-joined',
  PEER_LEFT:   'peer-left',

  // ── Call lifecycle (client → server) ───────────────────────────────────
  START_CALL:  'start-call',   // Caller initiates towards a targetUserId
  ACCEPT_CALL: 'accept-call',  // Callee accepts, sends SDP answer
  REJECT_CALL: 'reject-call',  // Callee declines
  END_CALL:    'end-call',     // Either side hangs up

  // ── Call lifecycle (server → client) ───────────────────────────────────
  INCOMING_CALL:   'incoming-call',    // Server → callee: you have an incoming call
  CALL_ANSWERED:   'call-answered',    // Server → caller: callee accepted, here's the answer
  CALL_REJECTED:   'call-rejected',    // Server → caller: callee declined
  CALL_ENDED:      'call-ended',       // Server → remote: other peer hung up
  CALL_ERROR:      'call-error',       // Server → client: something went wrong

  // ── WebRTC ICE signaling ────────────────────────────────────────────────
  ICE_CANDIDATE: 'ice-candidate',

  // ── Generic relay (for mesh topologies) ────────────────────────────────
  SIGNAL: 'signal',

  // ── Media state ─────────────────────────────────────────────────────────
  MEDIA_TOGGLE: 'media:toggle',
  MEDIA_STATE:  'media:state',

  // ── System ──────────────────────────────────────────────────────────────
  ERROR: 'error',
};

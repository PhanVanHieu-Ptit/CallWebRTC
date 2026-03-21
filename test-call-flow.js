/**
 * test-call-flow.js — E2E test for the call notification flow
 * Simulates: callee connects → caller connects → caller starts call → callee should receive incoming-call
 */
const io = require("socket.io-client");
const jwt = require("jsonwebtoken");

const SECRET = "JWT_TOKEN_KEY";
const RTC_URL = "http://localhost:4000";

// Step 1: Callee connects
const calleeToken = jwt.sign(
  { userId: "test-callee-123", email: "callee@test.com" },
  SECRET,
  { expiresIn: "1h" },
);
const callee = io(RTC_URL, { auth: { token: calleeToken } });

callee.on("connect", () => {
  console.log("[CALLEE] ✅ Connected with socket:", callee.id);
});
callee.on("connect_error", (err) => {
  console.log("[CALLEE] ❌ Connection FAILED:", err.message);
  process.exit(1);
});
callee.on("incoming-call", (data) => {
  console.log(
    "[CALLEE] ✅ RECEIVED INCOMING CALL:",
    JSON.stringify(data, null, 2),
  );
  callee.disconnect();
  setTimeout(() => process.exit(0), 300);
});

// Step 2: After callee connects, connect caller and start call
setTimeout(() => {
  const callerToken = jwt.sign(
    { userId: "test-caller-456", email: "caller@test.com" },
    SECRET,
    { expiresIn: "1h" },
  );
  const caller = io(RTC_URL, { auth: { token: callerToken } });

  caller.on("connect", () => {
    console.log("[CALLER] ✅ Connected with socket:", caller.id);

    const payload = {
      targetUserId: "test-callee-123",
      roomId: "test-room-001",
      callerName: "Test Caller",
      offer: { type: "offer", sdp: "fake-sdp-for-test" },
      callType: "video",
      callId: "test-call-id",
    };
    console.log("[CALLER] Emitting start-call → target:", payload.targetUserId);
    caller.emit("start-call", payload);
  });

  caller.on("connect_error", (err) => {
    console.log("[CALLER] ❌ Connection FAILED:", err.message);
    process.exit(1);
  });

  caller.on("call-error", (data) => {
    console.log("[CALLER] ❌ call-error received:", JSON.stringify(data));
    process.exit(1);
  });
}, 1500);

// Timeout
setTimeout(() => {
  console.log(
    "❌ TIMEOUT — callee never received the incoming-call event after 8s",
  );
  process.exit(1);
}, 8000);

/**
 * test-real-users.js — Check if any real browser users are connected to the RTC service
 */
const io = require("socket.io-client");
const jwt = require("jsonwebtoken");
const http = require("http");

const SECRET = "JWT_TOKEN_KEY";
const API_KEY = "INTERNAL_API_KEY";

// Query the internal API with a test user to introspect
const checkUser = (targetUserId) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      event: "debug-ping",
      targetUserId,
      payload: { test: true },
    });
    const req = http.request(
      {
        hostname: "localhost",
        port: 4000,
        path: "/internal/notify-call",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": API_KEY,
          "Content-Length": data.length,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

// Connect a test socket to see the server-side logs
const token = jwt.sign({ userId: "debug-probe" }, SECRET, { expiresIn: "1m" });
const sock = io("http://localhost:4000", {
  auth: { token },
  transports: ["websocket"],
});

sock.on("connect", async () => {
  console.log(
    "[PROBE] Connected. Check the RTC server terminal for room/user info.",
  );

  // Also test the internal API
  const result = await checkUser("nonexistent-user");
  console.log(
    "[PROBE] Internal API response for nonexistent user:",
    result.body,
  );

  sock.disconnect();
  process.exit(0);
});

sock.on("connect_error", (err) => {
  console.log("[PROBE] Connection error:", err.message);
  process.exit(1);
});

setTimeout(() => process.exit(0), 3000);

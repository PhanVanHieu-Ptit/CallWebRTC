# WebRTC Signaling Microservice Implementation Plan

This plan outlines the architecture and implementation of a standalone, scalable WebRTC signaling service.

## 🏗️ Architecture

The service acts as a "matchmaker" for WebRTC peers. It does not touch the media stream (which is P2P) but facilitates the exchange of session descriptions (SDP) and ICE candidates.

### Components
- **Node.js + Express**: Basic server framework.
- **Socket.io**: Real-time bidirectional communication.
- **Redis Adapter**: For horizontal scaling across multiple server instances.
- **JWT**: For secure authentication via the handshake phase.

## 📂 Project Structure

```text
signaling-service/
├── src/
│   ├── config/
│   │   └── index.js        # Environment variables and config
│   ├── middleware/
│   │   └── auth.js         # JWT socket middleware
│   ├── socket/
│   │   ├── events.js       # Event name constants
│   │   ├── handlers.js     # Room and signal logic
│   │   └── index.js        # Socket.io initialization
│   ├── server.js           # Server setup
│   └── index.js            # Entry point
├── .env                    # Environment variables
├── package.json
└── README.md
```

## 🔄 Socket Event Flow

| Event | Direction | Description |
| :--- | :--- | :--- |
| `join-room` | Client -> Server | Joins a specific room ID. |
| `peer-joined` | Server -> Room | Notifies others that a new peer is available. |
| `signal` | Client -> Peer | Relays SDP/ICE data to a specific peer. |
| `peer-left` | Server -> Room | Notifies others when a peer leaves. |

## 🚀 Scalability Strategy

To scale horizontally:
1.  **Redis Pub/Sub**: Use `@socket.io/redis-adapter`.
2.  **Sticky Sessions**: If using a Load Balancer (like Nginx), ensure sticky sessions are enabled for HTTP long-polling fallback, or force WebSocket-only transport.

## 🛡️ Security
- **JWT Authentication**: Socket connection is rejected if the token is invalid or missing.
- **Rate Limiting**: Prevent abuse of the signaling channel.
- **Room Isolation**: Ensure peers can only signal others in the same room.

## 🛠️ Implementation Steps
1.  Initialize project and install dependencies (`socket.io`, `jsonwebtoken`, `dotenv`, `redis`).
2.  Setup basic Express server with Socket.io.
3.  Implement JWT middleware for Socket.io.
4.  Implement room joining and signaling relay logic.
5.  Add Redis adapter configuration.
6.  Provide a React frontend example snippet.

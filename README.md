# CallWebRTC

Real-time **audio call** and **video streaming** application built with WebRTC, Node.js, Express, and Socket.io.

## Features

- 🎥 **Multi-party video calls** – camera streams with live video tiles for every participant
- 🎤 **Audio calls** – mute/unmute microphone at any time
- 🖥️ **Screen sharing** – share your screen with a single click, restore camera afterwards
- 🔇 **Media controls** – toggle audio/video independently; peers see your state in real time
- 🚪 **Room management** – join any named room by ID; multiple rooms run independently
- ⚡ **No plugins required** – uses the browser's native WebRTC and `getUserMedia` APIs
- 📱 **Responsive UI** – dark-themed, works on desktop and mobile browsers

## Architecture

```
Browser A ──┐                  ┌── Browser B
            │   Socket.io      │
            └─► Node.js  ◄─────┘
               signaling
               server
            (offer/answer/ICE)
```

Peers connect **directly** (P2P) once signaling is complete.  
The server only relays SDP offers/answers and ICE candidates – media never passes through the server.

## Getting Started

### Prerequisites

- Node.js ≥ 14

### Install & Run

```bash
npm install
npm start
```

Open **http://localhost:3000** in your browser.

### Environment Variables

| Variable | Default | Description          |
|----------|---------|----------------------|
| `PORT`   | `3000`  | HTTP server port     |

## Usage

1. Open the app and enter your name plus a **Room ID** (or click the ↻ button to generate one).
2. Click **Join Room**.
3. Share the same Room ID with the person(s) you want to call.
4. Use the control bar at the bottom to:
   - **Mute** – toggle your microphone
   - **Video** – toggle your camera
   - **Screen** – start / stop screen sharing
   - **End** – leave the call and return to the landing page

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Server    | Node.js · Express · Socket.io       |
| Signaling | Socket.io events (offer/answer/ICE) |
| Media     | WebRTC `RTCPeerConnection`          |
| Frontend  | Vanilla HTML · CSS · JavaScript     |

## Production Notes

- For calls across different networks you will need a **TURN server** (e.g. coturn).  
  Add your TURN credentials to the `iceConfig` object in `public/js/room.js`.
- Consider adding TLS (HTTPS) – required by browsers to access `getUserMedia` on non-localhost origins.


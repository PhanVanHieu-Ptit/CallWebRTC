'use strict';

/**
 * room.js – WebRTC signaling + media management for CallWebRTC
 *
 * Flow (offer/answer):
 *   When a new user joins a room, the server sends 'room-users' with a list
 *   of existing socket IDs.  The newcomer creates an RTCPeerConnection for
 *   each existing peer and sends an offer.  Existing peers answer when they
 *   receive the offer.  ICE candidates are exchanged via the signaling server.
 */

(function () {
  /* ── Read URL params ──────────────────────────────────────────────────── */
  const params   = new URLSearchParams(window.location.search);
  const roomId   = (params.get('room') || '').trim().slice(0, 64);
  const userName = (params.get('name') || 'Anonymous').trim().slice(0, 32);

  if (!roomId) {
    window.location.href = '/';
    return;
  }

  /* ── DOM refs ──────────────────────────────────────────────────────────── */
  const localVideo     = document.getElementById('local-video');
  const localTile      = document.getElementById('local-tile');
  const localNameEl    = document.getElementById('local-name');
  const videoGrid      = document.getElementById('video-grid');
  const waitingOverlay = document.getElementById('waiting-overlay');
  const shareRoomIdEl  = document.getElementById('share-room-id');
  const roomNameDisp   = document.getElementById('room-name-display');
  const connBadge      = document.getElementById('connection-badge');
  const peerCountEl    = document.getElementById('peer-count');

  const btnAudio  = document.getElementById('btn-audio');
  const btnVideo  = document.getElementById('btn-video');
  const btnScreen = document.getElementById('btn-screen');
  const btnHangup = document.getElementById('btn-hangup');

  /* ── UI helpers ────────────────────────────────────────────────────────── */
  roomNameDisp.textContent = `Room: ${roomId}`;
  shareRoomIdEl.textContent = roomId;
  localNameEl.textContent  = `${userName} (You)`;
  document.title = `CallWebRTC – ${roomId}`;

  function updatePeerCount() {
    const n = peerConnections.size;
    peerCountEl.textContent = `${n} peer${n !== 1 ? 's' : ''}`;
    if (n > 0) {
      waitingOverlay.classList.add('hidden');
      connBadge.textContent = 'Connected';
      connBadge.className   = 'badge badge--connected';
    } else {
      waitingOverlay.classList.remove('hidden');
      connBadge.textContent = 'Waiting';
      connBadge.className   = 'badge badge--waiting';
    }
  }

  /* ── State ─────────────────────────────────────────────────────────────── */
  let localStream      = null;   // camera/mic stream
  let screenStream     = null;   // screen share stream
  let audioEnabled     = true;
  let videoEnabled     = true;
  let screenSharing    = false;

  // Map<socketId, { pc: RTCPeerConnection, videoEl, tileEl }>
  const peerConnections = new Map();

  /* ── ICE servers (STUN only; add TURN for production) ────────────────── */
  const iceConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  /* ── Socket.io ──────────────────────────────────────────────────────────── */
  const socket = io({ transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('[socket] connected:', socket.id);
    socket.emit('join-room', { roomId, userName });
  });

  socket.on('disconnect', () => {
    console.warn('[socket] disconnected');
  });

  /* ── Media capture ──────────────────────────────────────────────────────── */
  async function startLocalMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (_e) {
      // Fallback: audio only
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        videoEnabled = false;
        btnVideo.classList.remove('active');
        btnVideo.setAttribute('aria-pressed', 'false');
        localTile.classList.add('no-video');
      } catch (err) {
        console.error('[media] Cannot access any media device:', err);
        localStream = new MediaStream();
        audioEnabled = false;
        videoEnabled = false;
        btnAudio.classList.remove('active');
        btnVideo.classList.remove('active');
        localTile.classList.add('no-video');
      }
    }
    localVideo.srcObject = localStream;
  }

  /* ── Peer connection factory ─────────────────────────────────────────── */
  function createPeerConnection(remoteId) {
    if (peerConnections.has(remoteId)) return peerConnections.get(remoteId).pc;

    const pc = new RTCPeerConnection(iceConfig);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Remote stream → remote tile
    const remoteStream = new MediaStream();
    const { tileEl, videoEl } = createRemoteTile(remoteId);
    videoEl.srcObject = remoteStream;

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { targetId: remoteId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[pc:${remoteId}] state:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removeRemotePeer(remoteId);
      }
    };

    peerConnections.set(remoteId, { pc, tileEl, videoEl });
    updatePeerCount();
    return pc;
  }

  function createRemoteTile(remoteId) {
    const tileEl = document.createElement('div');
    tileEl.classList.add('video-tile');
    tileEl.id = `tile-${remoteId}`;

    const videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    const label = document.createElement('div');
    label.classList.add('tile-label');
    label.innerHTML = `<span class="peer-name" id="name-${remoteId}">Peer</span>`;

    const avatar = document.createElement('div');
    avatar.classList.add('avatar-fallback');
    avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="48" height="48"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;

    tileEl.appendChild(videoEl);
    tileEl.appendChild(label);
    tileEl.appendChild(avatar);
    videoGrid.appendChild(tileEl);

    // Show avatar when no video track is active
    videoEl.addEventListener('loadedmetadata', () => {
      if (videoEl.videoWidth === 0) {
        tileEl.classList.add('no-video');
      }
    });

    return { tileEl, videoEl };
  }

  function removeRemotePeer(remoteId) {
    const entry = peerConnections.get(remoteId);
    if (!entry) return;
    entry.pc.close();
    entry.tileEl.remove();
    peerConnections.delete(remoteId);
    updatePeerCount();
    console.log(`[peer] removed ${remoteId}`);
  }

  /* ── Signaling events ───────────────────────────────────────────────────── */

  // Server tells us who is already in the room → we initiate offers to each
  socket.on('room-users', async ({ users }) => {
    for (const remoteId of users) {
      const pc = createPeerConnection(remoteId);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetId: remoteId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[offer] error', err);
      }
    }
  });

  // A new user joined → we wait for their offer (they'll call us)
  socket.on('user-joined', ({ socketId, userName: name }) => {
    console.log(`[room] ${name} joined`);
    // Create the peer connection slot so we're ready for their offer
    createPeerConnection(socketId);
    // Set their display name
    const nameEl = document.getElementById(`name-${socketId}`);
    if (nameEl) nameEl.textContent = name;
  });

  // Receive offer from a peer
  socket.on('offer', async ({ from, sdp }) => {
    let pc = peerConnections.has(from) ? peerConnections.get(from).pc : createPeerConnection(from);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { targetId: from, sdp: pc.localDescription });
    } catch (err) {
      console.error('[answer] error', err);
    }
  });

  // Receive answer
  socket.on('answer', async ({ from, sdp }) => {
    const entry = peerConnections.get(from);
    if (!entry) return;
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error('[answer:setRemote] error', err);
    }
  });

  // Receive ICE candidate
  socket.on('ice-candidate', async ({ from, candidate }) => {
    const entry = peerConnections.get(from);
    if (!entry || !candidate) return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[ice] addIceCandidate error', err);
    }
  });

  // Peer disconnected
  socket.on('user-left', ({ socketId }) => {
    removeRemotePeer(socketId);
  });

  // Peer muted/unmuted
  socket.on('peer-media-state', ({ socketId, audio, video }) => {
    const entry = peerConnections.get(socketId);
    if (!entry) return;
    const tileEl  = entry.tileEl;
    if (!video) {
      tileEl.classList.add('no-video');
    } else {
      tileEl.classList.remove('no-video');
    }
  });

  /* ── Control buttons ──────────────────────────────────────────────────── */

  btnAudio.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    localStream.getAudioTracks().forEach((t) => { t.enabled = audioEnabled; });
    toggleBtn(btnAudio, audioEnabled);
    const iconAudio = document.querySelector('#local-media-icons .icon-audio');
    if (iconAudio) iconAudio.classList.toggle('muted', !audioEnabled);
    socket.emit('media-state', { audio: audioEnabled, video: videoEnabled });
  });

  btnVideo.addEventListener('click', async () => {
    if (screenSharing) return; // don't toggle camera while screen sharing

    videoEnabled = !videoEnabled;
    localStream.getVideoTracks().forEach((t) => { t.enabled = videoEnabled; });
    localTile.classList.toggle('no-video', !videoEnabled);
    toggleBtn(btnVideo, videoEnabled);
    socket.emit('media-state', { audio: audioEnabled, video: videoEnabled });
  });

  btnScreen.addEventListener('click', async () => {
    if (!screenSharing) {
      // Start screen share
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video sender track for all peers
        replaceVideoTrack(screenTrack);

        localVideo.srcObject = screenStream;
        localTile.classList.remove('no-video');
        screenSharing = true;
        btnScreen.classList.add('active');
        btnScreen.setAttribute('aria-pressed', 'true');

        // When the user ends screen share via browser UI
        screenTrack.onended = () => stopScreenShare();
      } catch (err) {
        console.error('[screen] getDisplayMedia error:', err);
      }
    } else {
      stopScreenShare();
    }
  });

  async function stopScreenShare() {
    if (!screenSharing) return;
    screenSharing = false;
    btnScreen.classList.remove('active');
    btnScreen.setAttribute('aria-pressed', 'false');

    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      screenStream = null;
    }

    // Restore camera track
    const camTracks = localStream.getVideoTracks();
    if (camTracks.length > 0) {
      replaceVideoTrack(camTracks[0]);
      camTracks[0].enabled = videoEnabled;
    }
    localVideo.srcObject = localStream;
    localTile.classList.toggle('no-video', !videoEnabled);
  }

  function replaceVideoTrack(newTrack) {
    peerConnections.forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(newTrack);
    });
  }

  btnHangup.addEventListener('click', hangup);

  function hangup() {
    peerConnections.forEach((_, id) => removeRemotePeer(id));
    if (localStream)  localStream.getTracks().forEach((t) => t.stop());
    if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
    socket.disconnect();
    window.location.href = '/';
  }

  /* ── Utility ─────────────────────────────────────────────────────────── */
  function toggleBtn(btn, isActive) {
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  (async function init() {
    await startLocalMedia();
    updatePeerCount();
  })();
})();

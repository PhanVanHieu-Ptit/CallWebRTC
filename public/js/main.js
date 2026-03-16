'use strict';

(function () {
  const form    = document.getElementById('join-form');
  const nameIn  = document.getElementById('user-name');
  const roomIn  = document.getElementById('room-id');
  const genBtn  = document.getElementById('gen-room');
  const errMsg  = document.getElementById('join-error');

  // Restore saved name from sessionStorage
  const savedName = sessionStorage.getItem('callwebrtc_name');
  if (savedName) nameIn.value = savedName;

  // Generate a random 8-char room ID
  function generateRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    for (let i = 0; i < 8; i++) {
      id += chars[array[i] % chars.length];
    }
    return id;
  }

  genBtn.addEventListener('click', () => {
    roomIn.value = generateRoomId();
    errMsg.textContent = '';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errMsg.textContent = '';

    const name = nameIn.value.trim();
    const room = roomIn.value.trim();

    if (!name) {
      errMsg.textContent = 'Please enter your name.';
      nameIn.focus();
      return;
    }
    if (!room) {
      errMsg.textContent = 'Please enter or generate a room ID.';
      roomIn.focus();
      return;
    }

    // Persist name so we can read it in room.html
    sessionStorage.setItem('callwebrtc_name', name);
    sessionStorage.setItem('callwebrtc_room', room);

    window.location.href = `/room.html?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`;
  });
})();

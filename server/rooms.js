/**
 * rooms.js — In-memory room state manager
 * Tracks which socket IDs belong to which rooms.
 * The server NEVER sees file bytes — only WebRTC signaling messages.
 */

const rooms = new Map();
// rooms: Map<roomId, { senderId: string, receiverId: string | null }>

/**
 * Create a new room with the sender's socket ID.
 * @param {string} roomId
 * @param {string} senderId - socket.id of the sender
 */
function createRoom(roomId, senderId) {
  rooms.set(roomId, { senderId, receiverId: null });
}

/**
 * Attempt to join an existing room as the receiver.
 * @param {string} roomId
 * @param {string} receiverId - socket.id of the receiver
 * @returns {{ success: boolean, senderId?: string, error?: string }}
 */
function joinRoom(roomId, receiverId) {
  if (!rooms.has(roomId)) {
    return { success: false, error: 'Room not found' };
  }
  const room = rooms.get(roomId);
  if (room.receiverId) {
    return { success: false, error: 'Room is full' };
  }
  room.receiverId = receiverId;
  return { success: true, senderId: room.senderId };
}

/**
 * Get the peer socket ID for a given socket in a room.
 * @param {string} roomId
 * @param {string} socketId - the socket asking for its peer
 * @returns {string | null}
 */
function getPeer(roomId, socketId) {
  if (!rooms.has(roomId)) return null;
  const room = rooms.get(roomId);
  if (room.senderId === socketId) return room.receiverId;
  if (room.receiverId === socketId) return room.senderId;
  return null;
}

/**
 * Get the room ID a given socket belongs to.
 * @param {string} socketId
 * @returns {string | null}
 */
function getRoomBySocket(socketId) {
  for (const [roomId, room] of rooms.entries()) {
    if (room.senderId === socketId || room.receiverId === socketId) {
      return roomId;
    }
  }
  return null;
}

/**
 * Remove a socket from its room. Deletes room if sender leaves.
 * @param {string} socketId
 * @returns {{ roomId: string, peerId: string | null } | null}
 */
function removeSocket(socketId) {
  const roomId = getRoomBySocket(socketId);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  let peerId = null;

  if (room.senderId === socketId) {
    // Sender left — dissolve the room
    peerId = room.receiverId;
    rooms.delete(roomId);
  } else if (room.receiverId === socketId) {
    // Receiver left — keep room open (sender may retry)
    peerId = room.senderId;
    room.receiverId = null;
  }

  return { roomId, peerId };
}

/**
 * Check if a room exists and has a sender (is active).
 * @param {string} roomId
 * @returns {boolean}
 */
function roomExists(roomId) {
  return rooms.has(roomId);
}

module.exports = { createRoom, joinRoom, getPeer, removeSocket, roomExists };

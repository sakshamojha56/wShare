/**
 * index.js — wShare Signaling Server
 *
 * Role: Pure WebRTC signaling relay. This server coordinates the
 * initial handshake (offer/answer/ICE) between peers.
 * FILE DATA IS NEVER SENT TO OR PROCESSED BY THIS SERVER.
 *
 * Events (client → server):
 *   create-room   : Sender creates a room and gets a unique roomId
 *   join-room     : Receiver joins an existing room
 *   offer         : Sender's SDP offer → forwarded to receiver
 *   answer        : Receiver's SDP answer → forwarded to sender
 *   ice-candidate : ICE candidate → forwarded to peer
 *
 * Events (server → client):
 *   room-created      : Confirms room creation with roomId
 *   room-joined       : Confirms receiver joined, triggers sender to offer
 *   peer-connected    : Notifies sender that a receiver has joined
 *   peer-disconnected : Notifies remaining peer of disconnection
 *   offer             : Forwarded SDP offer
 *   answer            : Forwarded SDP answer
 *   ice-candidate     : Forwarded ICE candidate
 *   error             : Room not found / room full
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createRoom, joinRoom, getPeer, removeSocket, roomExists } = require('./rooms');

const app = express();
const server = http.createServer(app);

// ─── CORS ──────────────────────────────────────────────────────────────────────
// In development allow any localhost origin (Vite may pick different ports).
// In production, restrict to CLIENT_URL env var.
const isDev = process.env.NODE_ENV !== 'production';

const corsOrigin = isDev
  ? (origin, cb) => {
      // Allow any localhost / 127.0.0.1 origin, or no origin (same-origin / Postman)
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        cb(null, true);
      } else {
        cb(new Error('CORS: origin not allowed — ' + origin));
      }
    }
  : [process.env.CLIENT_URL].filter(Boolean);

app.use(cors({ origin: corsOrigin, credentials: true }));

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e5, // 100 KB — signaling messages only, never file bytes
});

// ─── Health check endpoints ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('wShare Signaling Server is running smoothly! 🚀');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: 'active', timestamp: new Date().toISOString() });
});

// ─── Socket.io signaling logic ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  /**
   * Sender creates a room.
   * Emits: room-created { roomId }
   */
  socket.on('create-room', () => {
    const roomId = uuidv4();
    createRoom(roomId, socket.id);
    socket.join(roomId);
    socket.emit('room-created', { roomId });
    console.log(`[Room] Created: ${roomId} — sender: ${socket.id}`);
  });

  socket.on('error', (err) => {
    console.error(`[Socket Error] ${socket.id}:`, err);
  });

  /**
   * Receiver joins an existing room.
   * Emits to receiver: room-joined { roomId } OR error { message }
   * Emits to sender:   peer-connected
   */
  socket.on('join-room', ({ roomId }) => {
    const result = joinRoom(roomId, socket.id);

    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    socket.join(roomId);
    socket.emit('room-joined', { roomId });

    // Notify sender that receiver is ready — sender should now create an offer
    if (result.senderId) {
      io.to(result.senderId).emit('peer-connected', { receiverId: socket.id });
    }

    console.log(`[Room] ${socket.id} joined ${roomId}`);
  });

  /**
   * Forward SDP offer from sender to receiver.
   */
  socket.on('offer', ({ roomId, sdp }) => {
    const peerId = getPeer(roomId, socket.id);
    if (peerId) {
      io.to(peerId).emit('offer', { sdp, from: socket.id });
    }
  });

  /**
   * Forward SDP answer from receiver to sender.
   */
  socket.on('answer', ({ roomId, sdp }) => {
    const peerId = getPeer(roomId, socket.id);
    if (peerId) {
      io.to(peerId).emit('answer', { sdp, from: socket.id });
    }
  });

  /**
   * Forward ICE candidate to peer.
   */
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    const peerId = getPeer(roomId, socket.id);
    if (peerId) {
      io.to(peerId).emit('ice-candidate', { candidate });
    }
  });

  /**
   * Handle socket disconnect (tab close, network drop, etc.)
   */
  socket.on('disconnect', (reason) => {
    console.log(`[-] Socket disconnected: ${socket.id} (${reason})`);
    const result = removeSocket(socket.id);

    if (result?.peerId) {
      io.to(result.peerId).emit('peer-disconnected', {
        reason,
        roomId: result.roomId,
      });
    }
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 wShare Signaling Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

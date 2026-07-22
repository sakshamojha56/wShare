# wShare

<p align="center">
<img alt="React" src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge" />
  <img alt="WebRTC" src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge" />
  <img alt="Socket.IO" src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge" />
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?style=for-the-badge" />
</p>

<p align="center">
  <strong>A direct peer-to-peer file sharing application that transfers encrypted files between browsers without routing payloads through a server.</strong>
</p>

wShare is built around privacy-preserving transfer: the server coordinates signaling, while file data moves directly between peers over WebRTC. The client manages chunking, assembly, progress tracking, QR/link sharing, and connection state.

## Core Capabilities

- Creates sender and receiver flows for browser-to-browser file transfer.
- Uses Socket.IO signaling to establish peer connections.
- Chunks, encrypts, transfers, and reassembles files on the client side.
- Displays connection, share-link, and transfer-progress states through reusable components.

## Technical Architecture

The client is a Vite React application with WebRTC hooks and transfer utilities. The server is a compact Express and Socket.IO signaling service that manages rooms without handling file payloads.

## Technology Stack

- React and Vite for the browser client.
- WebRTC data channels for direct file transfer.
- Socket.IO and Express for signaling.
- Client-side chunking, assembly, and cryptographic utilities.
- QR code support for easy receiver onboarding.

## Repository Structure

- `client/src/hooks/useWebRTC.js` - Peer connection and data-channel logic.
- `client/src/hooks/useSignaling.js` - Socket signaling hook.
- `client/src/utils/chunker.js` - File chunking utility.
- `client/src/utils/assembler.js` - File reassembly utility.
- `server/index.js` - Signaling server entry point.
- `server/rooms.js` - Room state management.

## Getting Started

```bash
cd server && npm install
cd ../client && npm install
```

```bash
cd server && npm run dev
cd client && npm run dev
```

## Professional Context

This project demonstrates real-time web engineering, browser networking, file-transfer architecture, and user-focused privacy design.

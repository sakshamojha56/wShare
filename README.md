# ⚡ wShare

> **Direct, encrypted, browser-to-browser file transfer using WebRTC.**  
> No file data ever touches a server. Transfer happens peer-to-peer, secured with AES-256-GCM.

---

## 🚀 Live Demo

| Service | URL |
|---|---|
| Frontend | `https://p2p-share.vercel.app` *(deploy to Vercel)* |
| Signaling Server | `https://p2p-share-signal.onrender.com` *(deploy to Render)* |

---

## ✨ Features

### Core MVP
- 📁 **Drag-and-drop** file zone with visual feedback and file type icons
- 🔗 **Unique share room link** — send to recipient, transfer starts instantly
- 🌐 **Pure P2P transfer** via WebRTC DataChannel — no server relay for file data
- 🔐 **SHA-256 hash verification** — every transfer verified for integrity before download
- 📊 **Real-time progress UI** — percentage, transfer speed (MB/s), ETA
- ⚠️ **Graceful disconnect handling** — clean UI notification if peer drops mid-transfer
- ⬇️ **Auto-download** — receiver's browser saves the file automatically

### Advanced (Brownie Features)
- 🔒 **Zero-knowledge AES-256-GCM encryption** — key lives only in the URL hash (`#key=...`), never on the server
- 💾 **Large file support (>500MB)** via Origin Private File System (OPFS) — chunks stream to disk, not RAM
- 📱 **QR code sharing** — scan to receive on another device
- 🔄 **Native Share API** — share link via OS native share sheet on mobile

---

## 🏗️ Architecture

```
Browser A (Sender)              Signaling Server              Browser B (Receiver)
      |  ─── create-room ──────────▶ |                              |
      |  ◀── room-id ─────────────── |                              |
      |                              | ◀── join-room ────────────── |
      |  ◀── peer-connected ──────── |                              |
      |  ─── offer ─────────────────▶ ──── offer ─────────────────▶ |
      |  ◀── answer ─────────────── ◀──── answer ─────────────────  |
      |  ◀═══════════ ICE negotiation ════════════════════════════▶ |
      |                                                              |
      |  ══════════ WebRTC DataChannel (direct P2P) ═══════════════ |
      |     [AES-GCM encrypted 64KB chunks + SHA-256 hash]          |
```

**Key principle:** The signaling server only relays WebRTC handshake messages (SDP offers/answers, ICE candidates). File bytes NEVER touch the server.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite, CSS Custom Properties |
| P2P | Native WebRTC API (RTCPeerConnection + RTCDataChannel) |
| Signaling | Node.js + Express + Socket.io |
| Encryption | Web Crypto API (AES-GCM 256-bit) |
| Hashing | Web Crypto API (SHA-256) |
| Large Files | Origin Private File System (OPFS) |

---

## 📦 Local Development

### Prerequisites
- Node.js >= 18
- npm >= 9

### 1. Clone the repo
```bash
git clone https://github.com/<your-username>/wShare.git
cd wShare
```

### 2. Start the Signaling Server
```bash
cd server
npm install
npm run dev
# ▶ Signaling server running on http://localhost:3001
```

### 3. Start the React Frontend
```bash
cd client
npm install
npm run dev
# ▶ Frontend running on http://localhost:5173
```

### 4. Test a transfer
1. Open `http://localhost:5173` in **Browser Window A** (Sender)
2. Drop a file — a share link is generated
3. Open the generated link in **Browser Window B** (Receiver)
4. Watch the transfer happen directly between the two windows!

---

## 🚀 Deployment

### Frontend → Vercel
1. Connect your GitHub repo to Vercel
2. Set **Root Directory** to `client/`
3. Add environment variable: `VITE_SIGNALING_SERVER=https://your-render-url.onrender.com`
4. Deploy

### Signaling Server → Render
1. Create a new **Web Service** on Render
2. Set **Root Directory** to `server/`
3. Build command: `npm install`
4. Start command: `npm start`
5. Copy the Render URL → paste into Vercel env var above

---

## 📁 Project Structure

```
wShare/
├── client/                  # React.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DropZone.jsx        # File drag-and-drop
│   │   │   ├── ShareLink.jsx       # Room link + QR code
│   │   │   ├── ConnectionStatus.jsx # Animated status badge
│   │   │   ├── ProgressBar.jsx     # Transfer progress + speed
│   │   │   ├── SenderView.jsx      # Sender page
│   │   │   └── ReceiverView.jsx    # Receiver page
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js        # WebRTC connection + DataChannel
│   │   │   └── useSignaling.js     # Socket.io signaling
│   │   └── utils/
│   │       ├── crypto.js           # SHA-256 + AES-GCM
│   │       ├── chunker.js          # File → 64KB chunks
│   │       └── assembler.js        # Chunk reassembly + OPFS
│   └── vite.config.js
│
└── server/                  # Node.js signaling server
    ├── index.js             # Express + Socket.io
    └── rooms.js             # In-memory room state
```

---

## 🔒 Security Model

| Concern | Solution |
|---|---|
| File privacy | Files transfer P2P — never uploaded to any server |
| Encryption | AES-256-GCM applied per-chunk before sending |
| Key exchange | Key embedded in URL hash (`#key=...`) — HTTP never sends fragment to server |
| Integrity | SHA-256 hash of entire file compared sender→receiver |
| Signaling | Server only sees socket IDs and SDP/ICE messages |

---

## 📄 License

MIT — build freely, share widely.

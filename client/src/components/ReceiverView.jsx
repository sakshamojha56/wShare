import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { useSignaling } from '../hooks/useSignaling';
import { useWebRTC } from '../hooks/useWebRTC';
import { importKeyFromBase64 } from '../utils/crypto';

/**
 * ReceiverView — View for the file recipient.
 *
 * Flow:
 * 1. Extract roomId from URL params, encryption key from URL hash
 * 2. Join room via signaling server
 * 3. Receive WebRTC offer → send answer → wait for DataChannel
 * 4. Receive file chunks → verify hash → auto-download
 */
export function ReceiverView() {
  const { roomId } = useParams();
  const [status, setStatus] = useState('connecting');
  const [statusMsg, setStatusMsg] = useState('Joining room…');
  const [progress, setProgress] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [encKey, setEncKey] = useState(null);
  const [complete, setComplete] = useState(false);

  const roomIdRef = useRef(roomId);

  // ── Parse encryption key from URL hash ──────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#key=')) {
      const b64 = decodeURIComponent(hash.slice(5));
      importKeyFromBase64(b64)
        .then((key) => {
          console.log('[Receiver] Encryption key loaded from URL hash');
          setEncKey(key);
        })
        .catch((e) => console.warn('Invalid encryption key in URL hash:', e));
    }
  }, []);

  // ── WebRTC ──────────────────────────────────────────────────────────────
  // ── WebRTC — encKey passed as state so hook always has latest key ────────
  const {
    connectionState,
    createPeerConnection,
    handleOffer,
    handleIceCandidate,
    close: closeWebRTC,
  } = useWebRTC({
    encryptionKey: encKey,  // React state — always current
    onStateChange: (state) => {
      setStatus(state);
      if (state === 'connected') setStatusMsg('Secure connection established — waiting for file…');
      if (state === 'transferring') setStatusMsg('Receiving file…');
      if (state === 'verifying') setStatusMsg('Verifying file integrity…');
      if (state === 'complete') setStatusMsg('File verified ✓ — check your downloads!');
      if (state === 'error') setStatusMsg('Transfer failed. Hash mismatch detected.');
    },
    onProgress: (p) => {
      setProgress(p);
      if (p.fileMeta) setFileMeta(p.fileMeta);
    },
    onComplete: ({ fileName }) => {
      setComplete(true);
      setStatus('complete');
      setStatusMsg(`✓ "${fileName}" saved to your downloads`);
    },
    onError: (err) => {
      if (err === 'peer-disconnected') {
        setStatus('disconnected');
        setStatusMsg('Sender disconnected. Transfer was incomplete.');
      } else {
        setStatus('error');
        setErrorMsg(err);
      }
    },
  });

  // ── Signaling ────────────────────────────────────────────────────────────
  const signaling = useSignaling({
    onRoomJoined: ({ roomId: id }) => {
      setStatus('waiting');
      setStatusMsg('Joined room — waiting for sender to connect…');
    },

    onOffer: async ({ sdp }) => {
      setStatus('connecting');
      setStatusMsg('Establishing peer connection…');

      createPeerConnection({
        roomId: roomIdRef.current,
        isSender: false,
        signaling,
      });

      await handleOffer({ roomId: roomIdRef.current, sdp, signaling });
    },

    onIceCandidate: async ({ candidate }) => {
      await handleIceCandidate({ candidate });
    },

    onPeerDisconnected: () => {
      if (!complete) {
        setStatus('disconnected');
        setStatusMsg('Sender disconnected unexpectedly.');
      }
    },

    onError: ({ message }) => {
      setErrorMsg(message || 'Room not found or expired.');
      setStatus('error');
    },
  });

  // ── Join room on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (roomId) {
      signaling.joinRoom(roomId);
    }
  }, [roomId, signaling]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => closeWebRTC(), []);

  const isTransferring = status === 'transferring';
  const isWaiting = status === 'waiting' || status === 'connecting' || status === 'connected';

  return (
    <div className="receiver-view">
      {/* Header */}
      <div className="view-header">
        <div className="receiver-icon animate-float">📥</div>
        <h1 className="gradient-text">Receiving File</h1>
        <p>A direct peer-to-peer transfer is being established.<br />No data passes through any server.</p>
      </div>

      {/* Room ID badge */}
      <div className="room-badge">
        <span className="room-badge__label">Room</span>
        <span className="room-badge__id mono">{roomId}</span>
      </div>

      {/* Status card */}
      <div className="glass-card" style={{ padding: 24 }}>
        <ConnectionStatus state={status} message={statusMsg} />

        {/* Waiting animation */}
        {isWaiting && !progress && (
          <div className="waiting-animation">
            <div className="waiting-ring" />
            <div className="waiting-ring waiting-ring--2" />
            <div className="waiting-ring waiting-ring--3" />
          </div>
        )}

        {/* File info once transfer starts */}
        {progress && fileMeta && (
          <div className="file-info animate-fade-in">
            <div className="file-info__name">{fileMeta.name}</div>
            <div className="file-info__size">{formatBytes(fileMeta.size)}</div>
          </div>
        )}

        {/* Progress */}
        {isTransferring && progress && (
          <div style={{ marginTop: 20 }}>
            <ProgressBar
              percent={progress.percent}
              speed={progress.speed}
              eta={progress.eta}
              label="Receiving"
              bytesDone={progress.bytesReceived || 0}
              bytesTotal={progress.total * 65536}
            />
          </div>
        )}

        {/* Complete */}
        {complete && (
          <div className="success-banner animate-fade-in">
            <span style={{ fontSize: 32 }}>🎉</span>
            <div>
              <strong>Transfer complete!</strong>
              <p>File integrity verified via SHA-256. Check your downloads folder.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="error-banner animate-fade-in">⚠️ {errorMsg}</div>
        )}
      </div>

      {/* Security note */}
      <div className="security-note">
        <div className="security-note__icon">🔒</div>
        <div>
          <strong>End-to-End Encrypted</strong>
          <p>This transfer uses AES-256-GCM encryption. The decryption key exists only in the URL — never on any server.</p>
        </div>
      </div>

      <style>{`
        .receiver-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }
        .view-header { text-align: center; }
        .view-header h1 { margin-bottom: 8px; }
        .view-header p { color: #64748b; font-size: 14px; line-height: 1.6; }
        .receiver-icon { font-size: 56px; margin-bottom: 12px; display: block; }

        .room-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 10px 16px;
          align-self: center;
        }
        .room-badge__label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
        }
        .room-badge__id {
          font-size: 13px;
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }

        .waiting-animation {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 28px auto;
        }
        .waiting-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(99,102,241,0.4);
          animation: expand-ring 2s ease-out infinite;
        }
        .waiting-ring--2 { animation-delay: 0.6s; }
        .waiting-ring--3 { animation-delay: 1.2s; }
        @keyframes expand-ring {
          0% { transform: scale(0.3); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }

        .file-info {
          margin-top: 16px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.03);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .file-info__name {
          font-weight: 600;
          font-size: 15px;
          color: #f1f5f9;
          margin-bottom: 4px;
        }
        .file-info__size {
          font-size: 13px;
          color: #6366f1;
          font-family: 'JetBrains Mono', monospace;
        }

        .success-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-top: 16px;
          padding: 16px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 12px;
        }
        .success-banner strong { color: #10b981; display: block; margin-bottom: 4px; font-size: 15px; }
        .success-banner p { color: #64748b; font-size: 13px; margin: 0; }

        .error-banner {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #ef4444;
          font-size: 13px;
        }

        .security-note {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 16px;
          background: rgba(99,102,241,0.04);
          border: 1px solid rgba(99,102,241,0.1);
          border-radius: 12px;
          font-size: 13px;
        }
        .security-note__icon { font-size: 22px; flex-shrink: 0; }
        .security-note strong { color: #6366f1; display: block; margin-bottom: 4px; }
        .security-note p { color: #475569; margin: 0; line-height: 1.5; }
      `}</style>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

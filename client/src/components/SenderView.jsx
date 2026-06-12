import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DropZone } from './DropZone';
import { ShareLink } from './ShareLink';
import { ConnectionStatus } from './ConnectionStatus';
import { ProgressBar } from './ProgressBar';
import { useSignaling } from '../hooks/useSignaling';
import { useWebRTC } from '../hooks/useWebRTC';
import { generateEncryptionKey, exportKeyToBase64 } from '../utils/crypto';

/**
 * SenderView — Main view for the file sender.
 *
 * Flow:
 * 1. User drops a file → encryption key generated → room created via signaling
 * 2. ShareLink displayed with roomId + key in URL hash (#key=...)
 * 3. When receiver joins → peer-connected → WebRTC offer sent
 * 4. DataChannel opens → sendFile() called automatically
 */
export function SenderView() {
  const [file, setFile] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [encKeyB64, setEncKeyB64] = useState('');
  const [encKey, setEncKey] = useState(null);  // actual CryptoKey — passed to useWebRTC
  const [status, setStatus] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [useEncryption, setUseEncryption] = useState(true);

  const roomIdRef = useRef('');
  const pcCreatedRef = useRef(false);
  const sentRef = useRef(false);
  const fileRef = useRef(null); // keep latest file in ref for the sendFile effect

  // ── WebRTC — now receives encKey state directly ──────────────────────────
  const {
    connectionState,
    createPeerConnection,
    createOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    close: closeWebRTC,
  } = useWebRTC({
    encryptionKey: encKey,   // This is React state — updates properly
    onStateChange: (state) => {
      setStatus(state);
      if (state === 'connected') setStatusMsg('Peer connected — starting transfer…');
      if (state === 'transferring') setStatusMsg('Sending file…');
      if (state === 'verifying') setStatusMsg('Transfer complete — verifying…');
      if (state === 'complete') setStatusMsg('Transfer complete!');
    },
    onProgress: (p) => setProgress(p),
    onComplete: ({ fileName }) => {
      setStatus('complete');
      setStatusMsg(`✓ "${fileName}" delivered and verified`);
    },
    onError: (err) => {
      if (err === 'peer-disconnected') {
        setStatus('disconnected');
        setStatusMsg('Recipient disconnected. Transfer may be incomplete.');
      } else {
        setStatus('error');
        setErrorMsg(err);
      }
    },
  });

  // ── Signaling ────────────────────────────────────────────────────────────
  const signalingHandlers = {
    onRoomCreated: ({ roomId: id }) => {
      roomIdRef.current = id;
      setRoomId(id);
      setStatus('waiting');
      setStatusMsg('Waiting for recipient to open the link…');
    },

    onPeerConnected: async () => {
      if (pcCreatedRef.current) return;
      pcCreatedRef.current = true;
      setStatus('connecting');
      setStatusMsg('Recipient joined — establishing secure connection…');

      createPeerConnection({
        roomId: roomIdRef.current,
        isSender: true,
        signaling,
      });
      await createOffer({ roomId: roomIdRef.current, signaling });
    },

    onAnswer: async ({ sdp }) => {
      await handleAnswer({ sdp });
    },

    onIceCandidate: async ({ candidate }) => {
      await handleIceCandidate({ candidate });
    },

    onPeerDisconnected: () => {
      pcCreatedRef.current = false;
      if (status !== 'complete') {
        setStatus('disconnected');
        setStatusMsg('Recipient disconnected unexpectedly.');
      }
    },

    onError: ({ message }) => {
      setErrorMsg(message || 'Signaling error');
      setStatus('error');
    },
  };

  const signaling = useSignaling(signalingHandlers);

  // ── Auto-send when DataChannel opens ────────────────────────────────────
  useEffect(() => {
    if (connectionState === 'connected' && fileRef.current && !sentRef.current) {
      sentRef.current = true;
      sendFile(fileRef.current);
    }
  }, [connectionState, sendFile]);

  // ── File selected: generate key, create room ─────────────────────────────
  const handleFileSelect = useCallback(async (selectedFile) => {
    // Reset
    closeWebRTC();
    setFile(selectedFile);
    fileRef.current = selectedFile;
    setRoomId('');
    setEncKeyB64('');
    setEncKey(null);
    setErrorMsg('');
    setProgress(null);
    setStatus('idle');
    setStatusMsg('');
    sentRef.current = false;
    pcCreatedRef.current = false;

    // Generate AES-GCM key (zero-knowledge brownie)
    if (useEncryption) {
      const key = await generateEncryptionKey();
      const b64 = await exportKeyToBase64(key);
      setEncKey(key);      // React state → triggers useWebRTC re-render with new key
      setEncKeyB64(b64);
    }

    // Small delay to let state settle before creating room
    setTimeout(() => {
      signaling.createRoom();
    }, 50);
  }, [signaling, closeWebRTC, useEncryption]);

  const handleReset = () => {
    closeWebRTC();
    setFile(null);
    fileRef.current = null;
    setRoomId('');
    setEncKeyB64('');
    setEncKey(null);
    setStatus('idle');
    setStatusMsg('');
    setProgress(null);
    setErrorMsg('');
    sentRef.current = false;
    pcCreatedRef.current = false;
  };

  const isTransferring = status === 'transferring';
  const isComplete = status === 'complete';
  const showReset = ['complete', 'error', 'disconnected', 'failed'].includes(status);
  const showShareLink = roomId && (status === 'waiting' || status === 'connecting');

  return (
    <div className="sender-view">
      {/* Header */}
      <div className="view-header">
        <h1 className="gradient-text">Share a File</h1>
        <p>Drop your file below. Share the link. Transfer goes directly browser-to-browser.</p>
      </div>

      {/* Encryption toggle */}
      {!roomId && (
        <label className="enc-toggle" htmlFor="enc-toggle-cb">
          <input
            id="enc-toggle-cb"
            type="checkbox"
            checked={useEncryption}
            onChange={(e) => setUseEncryption(e.target.checked)}
          />
          <span className="enc-toggle__track" />
          <span className="enc-toggle__label">
            🔐 Zero-knowledge encryption (AES-256-GCM)
          </span>
        </label>
      )}

      {/* Drop zone */}
      <DropZone
        onFileSelect={handleFileSelect}
        disabled={isTransferring || (!!roomId && status !== 'complete' && status !== 'error' && status !== 'disconnected')}
      />

      {/* Status card */}
      {status !== 'idle' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ConnectionStatus state={status} message={statusMsg} />

          {showShareLink && (
            <ShareLink roomId={roomId} encryptionKeyB64={encKeyB64} />
          )}

          {isTransferring && progress && (
            <ProgressBar
              percent={progress.percent}
              speed={progress.speed}
              eta={progress.eta}
              label="Sending"
              bytesDone={progress.bytesSent || 0}
              bytesTotal={file?.size || 0}
            />
          )}

          {isComplete && (
            <div className="success-banner animate-fade-in">
              <span>🎉</span>
              <div>
                <strong>File delivered!</strong>
                <p>SHA-256 verified. "{file?.name}" received successfully.</p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="error-banner animate-fade-in">⚠️ {errorMsg}</div>
          )}
        </div>
      )}

      {/* Reset */}
      {showReset && (
        <button id="share-another-btn" className="btn btn-ghost w-full" onClick={handleReset}>
          ↩ Share Another File
        </button>
      )}

      <style>{`
        .sender-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }
        .view-header { text-align: center; }
        .view-header h1 { margin-bottom: 8px; }
        .view-header p { color: #64748b; font-size: 15px; }

        .enc-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 10px;
          padding: 12px 16px;
          user-select: none;
        }
        .enc-toggle input[type="checkbox"] { display: none; }
        .enc-toggle__track {
          width: 36px;
          height: 20px;
          border-radius: 999px;
          background: #1e293b;
          border: 2px solid rgba(255,255,255,0.1);
          position: relative;
          flex-shrink: 0;
          transition: background 200ms;
        }
        .enc-toggle__track::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #475569;
          transition: transform 200ms, background 200ms;
        }
        .enc-toggle input:checked + .enc-toggle__track { background: rgba(99,102,241,0.5); border-color: rgba(99,102,241,0.5); }
        .enc-toggle input:checked + .enc-toggle__track::after { transform: translateX(16px); background: #6366f1; }
        .enc-toggle__label { font-size: 13px; font-weight: 500; color: #94a3b8; }

        .success-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 12px;
          font-size: 14px;
        }
        .success-banner span { font-size: 24px; }
        .success-banner strong { color: #10b981; display: block; margin-bottom: 4px; }
        .success-banner p { color: #64748b; font-size: 13px; margin: 0; }

        .error-banner {
          padding: 12px 16px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          color: #ef4444;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

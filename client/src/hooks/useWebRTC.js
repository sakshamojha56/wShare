/**
 * useWebRTC.js — Core WebRTC connection and DataChannel management hook
 *
 * Key fixes:
 *  - encryptionKey is stored in a ref so it's always current without causing stale closures
 *  - setupSenderChannel/setupReceiverChannel are defined BEFORE createPeerConnection
 *  - Callbacks use refs for onStateChange/onProgress/onComplete/onError to avoid stale closures
 *  - sendFile reads encryptionKey from ref at call time, not at hook-init time
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { sha256, encryptChunk, decryptChunk } from '../utils/crypto';
import { CHUNK_SIZE, readChunk, getTotalChunks, packChunk, unpackChunk } from '../utils/chunker';
import {
  assembleChunks,
  verifyHash,
  triggerDownload,
  isOPFSSupported,
  createOPFSWriter,
} from '../utils/assembler';

// Public STUN servers for ICE negotiation
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Backpressure thresholds
const BUFFER_HIGH_THRESHOLD = 4 * 1024 * 1024; // 4 MB — pause sending
const BUFFER_LOW_THRESHOLD = 512 * 1024;        // 512 KB — resume sending

export function useWebRTC({ onStateChange, onProgress, onComplete, onError, encryptionKey }) {
  // ── Refs for mutable state (avoid stale closures) ────────────────────────
  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const encKeyRef = useRef(encryptionKey);      // Always current key
  const callbacksRef = useRef({ onStateChange, onProgress, onComplete, onError });

  // Keep refs fresh on every render
  useEffect(() => {
    encKeyRef.current = encryptionKey;
  }, [encryptionKey]);

  useEffect(() => {
    callbacksRef.current = { onStateChange, onProgress, onComplete, onError };
  });

  // Sender control
  const sendingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeRef = useRef(null); // resolve fn for backpressure promise

  // Receiver state
  const chunkMapRef = useRef(new Map());
  const opfsWriterRef = useRef(null);
  const metaRef = useRef(null);
  const receivedCountRef = useRef(0);
  const speedTrackerRef = useRef({ lastTime: 0, lastBytes: 0, bytes: 0 });

  const [connectionState, setConnectionState] = useState('idle');

  // Queue for early ICE candidates
  const iceCandidateQueueRef = useRef([]);

  // ── Helper: emit state change ────────────────────────────────────────────
  const emitState = useCallback((state) => {
    setConnectionState(state);
    callbacksRef.current.onStateChange?.(state);
  }, []);

  // ── Sender DataChannel setup — defined BEFORE createPeerConnection ────────
  const setupSenderChannel = useCallback((channel) => {
    channel.bufferedAmountLowThreshold = BUFFER_LOW_THRESHOLD;

    channel.onopen = () => {
      console.log('[DataChannel] Open — sender');
      emitState('connected');
    };

    channel.onbufferedamountlow = () => {
      if (pausedRef.current && resumeRef.current) {
        pausedRef.current = false;
        const resolve = resumeRef.current;
        resumeRef.current = null;
        resolve();
      }
    };

    channel.onerror = (e) => callbacksRef.current.onError?.('DataChannel error: ' + (e.message || 'unknown'));
    channel.onclose = () => console.log('[DataChannel] Closed — sender');
  }, [emitState]);

  // ── Receiver DataChannel setup — defined BEFORE createPeerConnection ──────
  const setupReceiverChannel = useCallback((channel) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('[DataChannel] Open — receiver');
      emitState('connected');
    };

    channel.onmessage = async ({ data }) => {
      // ── JSON control messages ──
      if (typeof data === 'string') {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }

        if (msg.type === 'file-meta') {
          metaRef.current = msg;
          chunkMapRef.current = new Map();
          receivedCountRef.current = 0;
          opfsWriterRef.current = null;
          speedTrackerRef.current = { lastTime: Date.now(), lastBytes: 0, bytes: 0 };
          emitState('transferring');

          // Large file path: use OPFS to avoid RAM blowup
          if (msg.size > 100 * 1024 * 1024 && isOPFSSupported()) {
            opfsWriterRef.current = await createOPFSWriter(msg.sessionId || crypto.randomUUID());
          }
        }

        if (msg.type === 'transfer-complete') {
          await finalizeTransfer();
        }
        return;
      }

      // ── Binary chunk: [4-byte index][data] ──
      if (data instanceof ArrayBuffer) {
        const { index, data: chunkData } = unpackChunk(data);
        const key = encKeyRef.current;

        let finalData;
        if (key) {
          try {
            finalData = await decryptChunk(key, chunkData);
          } catch (e) {
            callbacksRef.current.onError?.('Decryption failed for chunk ' + index);
            return;
          }
        } else {
          finalData = chunkData;
        }

        const chunkArray = new Uint8Array(finalData);

        if (opfsWriterRef.current) {
          await opfsWriterRef.current.write(index, chunkArray);
        } else {
          chunkMapRef.current.set(index, chunkArray);
        }

        receivedCountRef.current++;
        const meta = metaRef.current;
        if (!meta) return;

        // Rolling speed calc
        const now = Date.now();
        const tracker = speedTrackerRef.current;
        tracker.bytes += chunkArray.byteLength;
        const elapsed = (now - tracker.lastTime) / 1000;
        let speed = 0;
        if (elapsed > 0.3) {
          speed = (tracker.bytes - tracker.lastBytes) / elapsed;
          tracker.lastBytes = tracker.bytes;
          tracker.lastTime = now;
        }

        const pct = receivedCountRef.current / meta.totalChunks;
        const remaining = ((1 - pct) * meta.size) / Math.max(speed, 1);

        callbacksRef.current.onProgress?.({
          received: receivedCountRef.current,
          total: meta.totalChunks,
          percent: Math.round(pct * 100),
          speed,
          eta: remaining,
          bytesReceived: tracker.bytes,
          fileMeta: meta,
        });
      }
    };

    channel.onerror = () => callbacksRef.current.onError?.('DataChannel receive error');
    channel.onclose = () => console.log('[DataChannel] Closed — receiver');
  }, [emitState]);

  // ── Finalize transfer: verify hash + trigger download ────────────────────
  const finalizeTransfer = useCallback(async () => {
    const meta = metaRef.current;
    if (!meta) return;
    emitState('verifying');

    try {
      if (opfsWriterRef.current) {
        await opfsWriterRef.current.assemble(meta.name, meta.mimeType, meta.totalChunks);
        emitState('complete');
        callbacksRef.current.onComplete?.({ verified: true, fileName: meta.name });
      } else {
        const assembled = assembleChunks(chunkMapRef.current, meta.totalChunks);

        if (meta.fileHash) {
          const isValid = await verifyHash(assembled, meta.fileHash);
          if (!isValid) {
            callbacksRef.current.onError?.('Hash mismatch — file may be corrupted');
            emitState('error');
            return;
          }
        }

        triggerDownload(assembled, meta.name, meta.mimeType);
        emitState('complete');
        callbacksRef.current.onComplete?.({ verified: !!meta.fileHash, fileName: meta.name });
      }
    } catch (e) {
      callbacksRef.current.onError?.(e.message);
      emitState('error');
    }
  }, [emitState]);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeerConnection = useCallback(
    ({ roomId, isSender, signaling }) => {
      // Close any previous connection
      pcRef.current?.close();
      iceCandidateQueueRef.current = [];

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) signaling.sendIceCandidate(roomId, candidate);
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('[WebRTC] Connection state:', state);

        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          callbacksRef.current.onError?.('peer-disconnected');
          emitState('disconnected');
        }
      };

      if (isSender) {
        const channel = pc.createDataChannel('file-transfer', { ordered: true });
        channelRef.current = channel;
        setupSenderChannel(channel);
      } else {
        pc.ondatachannel = ({ channel }) => {
          channelRef.current = channel;
          setupReceiverChannel(channel);
        };
      }

      return pc;
    },
    [emitState, setupSenderChannel, setupReceiverChannel]
  );

  // ── Create offer (sender) ────────────────────────────────────────────────
  const createOffer = useCallback(async ({ roomId, signaling }) => {
    const pc = pcRef.current;
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signaling.sendOffer(roomId, pc.localDescription);
  }, []);

  // ── Handle offer (receiver) ──────────────────────────────────────────────
  const handleOffer = useCallback(async ({ roomId, sdp, signaling }) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Flush queued ICE candidates
    while (iceCandidateQueueRef.current.length > 0) {
      const candidate = iceCandidateQueueRef.current.shift();
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[ICE] Skipped candidate:', e.message); }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    signaling.sendAnswer(roomId, pc.localDescription);
  }, []);

  // ── Handle answer (sender) ───────────────────────────────────────────────
  const handleAnswer = useCallback(async ({ sdp }) => {
    const pc = pcRef.current;
    if (pc && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));

      // Flush queued ICE candidates
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn('[ICE] Skipped candidate:', e.message); }
      }
    }
  }, []);

  // ── Handle ICE candidate ─────────────────────────────────────────────────
  const handleIceCandidate = useCallback(async ({ candidate }) => {
    const pc = pcRef.current;
    if (!candidate || !pc) return;

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[ICE] Skipped candidate:', e.message);
      }
    } else {
      iceCandidateQueueRef.current.push(candidate);
    }
  }, []);

  // ── Send file (sender) ───────────────────────────────────────────────────
  const sendFile = useCallback(async (file) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== 'open') {
      callbacksRef.current.onError?.('DataChannel not open');
      return;
    }

    emitState('transferring');
    sendingRef.current = true;
    pausedRef.current = false;
    resumeRef.current = null;

    try {
      // Hash the file only if it's <= 100MB to prevent RAM blowup
      let fileHash = null;
      if (file.size <= 100 * 1024 * 1024) {
        const fullBuffer = await file.arrayBuffer();
        fileHash = await sha256(fullBuffer);
      }

      const totalChunks = getTotalChunks(file.size);
      const sessionId = crypto.randomUUID();

      // Send metadata
      channel.send(JSON.stringify({
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        fileHash,
        sessionId,
      }));

      const speedTracker = { startTime: Date.now(), bytesSent: 0 };
      const key = encKeyRef.current; // read current key at send time

      for (let i = 0; i < totalChunks; i++) {
        if (!sendingRef.current) break;

        // Backpressure: wait when buffer is saturated
        if (channel.bufferedAmount > BUFFER_HIGH_THRESHOLD) {
          pausedRef.current = true;
          await new Promise((resolve) => { resumeRef.current = resolve; });
        }

        const chunkData = await readChunk(file, i);

        const payload = key
          ? await encryptChunk(key, chunkData)
          : chunkData;

        channel.send(packChunk(i, payload));

        speedTracker.bytesSent += chunkData.byteLength;
        const elapsed = (Date.now() - speedTracker.startTime) / 1000 || 0.001;
        const speed = speedTracker.bytesSent / elapsed;

        callbacksRef.current.onProgress?.({
          sent: i + 1,
          total: totalChunks,
          percent: Math.round(((i + 1) / totalChunks) * 100),
          speed,
          eta: ((totalChunks - i - 1) * CHUNK_SIZE) / Math.max(speed, 1),
          bytesSent: speedTracker.bytesSent,
          fileMeta: { name: file.name, size: file.size },
        });
      }

      if (sendingRef.current) {
        channel.send(JSON.stringify({ type: 'transfer-complete' }));
        emitState('complete');
        callbacksRef.current.onComplete?.({ verified: true, fileName: file.name });
      }
    } catch (e) {
      console.error('[WebRTC] Send error:', e);
      callbacksRef.current.onError?.(e.message || 'Error sending file');
      emitState('error');
    }
  }, [emitState]);

  // ── Close / cleanup ──────────────────────────────────────────────────────
  const close = useCallback(() => {
    sendingRef.current = false;
    // Unblock any backpressure wait
    if (resumeRef.current) {
      resumeRef.current();
      resumeRef.current = null;
    }
    channelRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    channelRef.current = null;
    setConnectionState('idle');
  }, []);

  return {
    connectionState,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    close,
  };
}

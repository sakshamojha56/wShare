/**
 * useSignaling.js — Socket.io signaling hook
 *
 * Manages the WebSocket connection to the signaling server.
 * Provides functions to create/join rooms and emit WebRTC
 * signaling messages (offer, answer, ICE candidates).
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

let SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER;
if (!SIGNALING_SERVER || (SIGNALING_SERVER.includes('localhost') && window.location.hostname !== 'localhost')) {
  SIGNALING_SERVER = `http://${window.location.hostname}:3001`;
}

/**
 * @param {object} handlers - Event handler callbacks
 * @param {function} handlers.onRoomCreated
 * @param {function} handlers.onRoomJoined
 * @param {function} handlers.onPeerConnected
 * @param {function} handlers.onPeerDisconnected
 * @param {function} handlers.onOffer
 * @param {function} handlers.onAnswer
 * @param {function} handlers.onIceCandidate
 * @param {function} handlers.onError
 */
export function useSignaling(handlers) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref fresh without re-creating the socket
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const socket = io(SIGNALING_SERVER, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('[Signaling] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[Signaling] Disconnected:', reason));

    socket.on('room-created', (data) => handlersRef.current.onRoomCreated?.(data));
    socket.on('room-joined', (data) => handlersRef.current.onRoomJoined?.(data));
    socket.on('peer-connected', (data) => handlersRef.current.onPeerConnected?.(data));
    socket.on('peer-disconnected', (data) => handlersRef.current.onPeerDisconnected?.(data));
    socket.on('offer', (data) => handlersRef.current.onOffer?.(data));
    socket.on('answer', (data) => handlersRef.current.onAnswer?.(data));
    socket.on('ice-candidate', (data) => handlersRef.current.onIceCandidate?.(data));
    socket.on('error', (data) => handlersRef.current.onError?.(data));

    return () => {
      socket.disconnect();
    };
  }, []); // Only create socket once

  const createRoom = useCallback(() => {
    socketRef.current?.emit('create-room');
  }, []);

  const joinRoom = useCallback((roomId) => {
    socketRef.current?.emit('join-room', { roomId });
  }, []);

  const sendOffer = useCallback((roomId, sdp) => {
    socketRef.current?.emit('offer', { roomId, sdp });
  }, []);

  const sendAnswer = useCallback((roomId, sdp) => {
    socketRef.current?.emit('answer', { roomId, sdp });
  }, []);

  const sendIceCandidate = useCallback((roomId, candidate) => {
    socketRef.current?.emit('ice-candidate', { roomId, candidate });
  }, []);

  return useMemo(() => ({
    createRoom, joinRoom, sendOffer, sendAnswer, sendIceCandidate
  }), [createRoom, joinRoom, sendOffer, sendAnswer, sendIceCandidate]);
}

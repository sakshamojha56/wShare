import React from 'react';

/**
 * ConnectionStatus — Animated status pill showing WebRTC connection state.
 */

const STATE_CONFIG = {
  idle: { label: 'Ready', emoji: '⚪', className: 'status-idle' },
  waiting: { label: 'Waiting for recipient…', emoji: '⏳', className: 'status-waiting' },
  connecting: { label: 'Establishing connection…', emoji: '🔄', className: 'status-connecting' },
  connected: { label: 'Peer connected', emoji: '✅', className: 'status-connected' },
  transferring: { label: 'Transferring…', emoji: '⚡', className: 'status-transferring' },
  verifying: { label: 'Verifying file integrity…', emoji: '🔍', className: 'status-connecting' },
  complete: { label: 'Transfer complete', emoji: '🎉', className: 'status-complete' },
  error: { label: 'Transfer failed', emoji: '❌', className: 'status-error' },
  disconnected: { label: 'Peer disconnected', emoji: '⚠️', className: 'status-disconnected' },
  'peer-disconnected': { label: 'Peer disconnected', emoji: '⚠️', className: 'status-disconnected' },
  failed: { label: 'Connection failed', emoji: '❌', className: 'status-error' },
};

export function ConnectionStatus({ state = 'idle', message = '' }) {
  const config = STATE_CONFIG[state] || STATE_CONFIG.idle;

  return (
    <div className={`status-badge ${config.className} animate-fade-in`} role="status" aria-live="polite">
      <span className="dot" />
      <span>{config.emoji} {message || config.label}</span>
    </div>
  );
}

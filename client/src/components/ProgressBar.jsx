import React from 'react';

/**
 * ProgressBar — Animated transfer progress with speed and ETA.
 */

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '— MB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatETA(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

export function ProgressBar({ percent = 0, speed = 0, eta = 0, label = 'Transferring', bytesTotal = 0, bytesDone = 0 }) {
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className="progress-container animate-fade-in">
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-percent gradient-text">{clampedPercent}%</span>
      </div>

      <div className="progress-track" role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="progress-fill"
          style={{ width: `${clampedPercent}%` }}
        />
      </div>

      <div className="progress-stats">
        <span className="progress-stat">
          <span className="progress-stat-label">Speed</span>
          <span className="progress-stat-value">{formatSpeed(speed)}</span>
        </span>

        <span className="progress-stat">
          <span className="progress-stat-label">ETA</span>
          <span className="progress-stat-value">{formatETA(eta)}</span>
        </span>

        {bytesTotal > 0 && (
          <span className="progress-stat">
            <span className="progress-stat-label">Size</span>
            <span className="progress-stat-value">
              {formatBytes(bytesDone)} / {formatBytes(bytesTotal)}
            </span>
          </span>
        )}
      </div>

      <style>{`
        .progress-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .progress-label {
          font-size: 14px;
          font-weight: 500;
          color: #94a3b8;
        }
        .progress-percent {
          font-size: 22px;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }
        .progress-stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .progress-stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .progress-stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
          font-weight: 600;
        }
        .progress-stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #f1f5f9;
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </div>
  );
}

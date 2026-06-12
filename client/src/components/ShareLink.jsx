import React, { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/**
 * ShareLink — Displays the room share URL with copy button and QR code.
 * Includes encryption key in URL hash for zero-knowledge transfers.
 */
export function ShareLink({ roomId, encryptionKeyB64 }) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const shareUrl = encryptionKeyB64
    ? `${window.location.origin}/receive/${roomId}#key=${encryptionKeyB64}`
    : `${window.location.origin}/receive/${roomId}`;

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [shareUrl]);

  if (!roomId) return null;

  return (
    <div className="share-link animate-fade-in-up">
      <div className="share-link__header">
        <div className="share-link__title">
          <span className="share-link__icon">🔗</span>
          Share Link
        </div>
        {encryptionKeyB64 && (
          <div className="share-link__encrypted-badge">
            <span>🔐</span> End-to-End Encrypted
          </div>
        )}
      </div>

      <div className="share-link__url-row">
        <div className="share-link__url mono">
          {shareUrl.length > 60 ? shareUrl.slice(0, 57) + '…' : shareUrl}
        </div>
        <button
          id="copy-link-btn"
          className={`btn btn-sm ${copied ? 'btn-copied' : 'btn-ghost'}`}
          onClick={copyToClipboard}
          title="Copy link to clipboard"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      <div className="share-link__actions">
        <button
          id="toggle-qr-btn"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowQR((v) => !v)}
        >
          {showQR ? 'Hide QR' : '📱 Show QR Code'}
        </button>

        {typeof navigator.share === 'function' && (
          <button
            id="native-share-btn"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              navigator.share({
                title: 'wShare',
                text: 'Click to receive the file directly from my browser',
                url: shareUrl,
              })
            }
          >
            ↑ Share
          </button>
        )}
      </div>

      {showQR && (
        <div className="share-link__qr animate-fade-in">
          <QRCodeSVG
            value={shareUrl}
            size={180}
            bgColor="transparent"
            fgColor="#f1f5f9"
            level="M"
            style={{ borderRadius: 12 }}
          />
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
            Scan to receive on another device
          </p>
        </div>
      )}

      <div className="share-link__note">
        Send this link to your recipient. The file transfers directly — no server ever sees your data.
      </div>

      <style>{`
        .share-link {
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .share-link__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .share-link__title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 15px;
          color: #f1f5f9;
        }
        .share-link__icon { font-size: 18px; }
        .share-link__encrypted-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #10b981;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 999px;
          padding: 4px 10px;
        }
        .share-link__url-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 14px;
        }
        .share-link__url {
          flex: 1;
          font-size: 12px;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
        }
        .btn-copied {
          background: rgba(16,185,129,0.15);
          border: 1px solid rgba(16,185,129,0.4);
          color: #10b981;
        }
        .share-link__actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .share-link__qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px;
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .share-link__note {
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

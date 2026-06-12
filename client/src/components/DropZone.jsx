import React, { useCallback, useState } from 'react';

/**
 * DropZone — Drag-and-drop file selector with visual feedback.
 * Validates file size and emits the selected File to onFileSelect.
 */

const MAX_SIZE_MB = 500; // soft limit — OPFS handles >100MB
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const FILE_ICONS = {
  'image/': '🖼️',
  'video/': '🎥',
  'audio/': '🎵',
  'application/pdf': '📄',
  'application/zip': '🗜️',
  'text/': '📝',
};

function getFileIcon(mimeType = '') {
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(prefix)) return icon;
  }
  return '📦';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function DropZone({ onFileSelect, disabled = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFile = useCallback((file) => {
    setError('');

    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  }, [onFileSelect]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile, disabled]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = useCallback((e) => {
    handleFile(e.target.files[0]);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div style={{ width: '100%' }}>
      <label
        htmlFor="file-input"
        className={`drop-zone ${isDragging ? 'drop-zone--dragging' : ''} ${disabled ? 'drop-zone--disabled' : ''} ${selectedFile ? 'drop-zone--filled' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          display: 'block',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          id="file-input"
          type="file"
          onChange={onInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <div className="drop-zone__content">
          {selectedFile ? (
            <>
              <div className="drop-zone__icon animate-float">
                {getFileIcon(selectedFile.type)}
              </div>
              <div className="drop-zone__file-name">{selectedFile.name}</div>
              <div className="drop-zone__file-size">{formatBytes(selectedFile.size)}</div>
              <div className="drop-zone__hint" style={{ marginTop: 8 }}>
                Click or drag to change file
              </div>
            </>
          ) : (
            <>
              <div className="drop-zone__icon animate-float">
                {isDragging ? '📂' : '📁'}
              </div>
              <div className="drop-zone__title">
                {isDragging ? 'Release to drop' : 'Drop your file here'}
              </div>
              <div className="drop-zone__hint">
                or <span className="drop-zone__browse">browse files</span>
              </div>
              <div className="drop-zone__limit">Up to {MAX_SIZE_MB} MB</div>
            </>
          )}
        </div>
      </label>

      {error && (
        <div className="drop-zone__error animate-fade-in">
          ⚠️ {error}
        </div>
      )}

      <style>{`
        .drop-zone {
          width: 100%;
          min-height: 220px;
          border: 2px dashed rgba(255,255,255,0.12);
          border-radius: 20px;
          background: rgba(255,255,255,0.025);
          transition: all 250ms cubic-bezier(0.4,0,0.2,1);
          position: relative;
          overflow: hidden;
        }
        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(99,102,241,0.05) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 250ms;
        }
        .drop-zone--dragging {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 40px rgba(99,102,241,0.15), inset 0 0 40px rgba(99,102,241,0.05);
        }
        .drop-zone--dragging::before { opacity: 1; }
        .drop-zone--filled {
          border-color: rgba(16,185,129,0.4);
          border-style: solid;
        }
        .drop-zone--disabled { opacity: 0.5; }
        .drop-zone__content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          padding: 32px 24px;
          gap: 8px;
          text-align: center;
        }
        .drop-zone__icon { font-size: 48px; line-height: 1; margin-bottom: 8px; }
        .drop-zone__title {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
        }
        .drop-zone__file-name {
          font-size: 16px;
          font-weight: 600;
          color: #f1f5f9;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .drop-zone__file-size {
          font-size: 13px;
          color: #10b981;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 500;
        }
        .drop-zone__hint {
          font-size: 14px;
          color: #64748b;
        }
        .drop-zone__browse {
          color: #6366f1;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .drop-zone__limit {
          margin-top: 4px;
          font-size: 12px;
          color: #475569;
          background: rgba(255,255,255,0.04);
          padding: 4px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .drop-zone__error {
          margin-top: 12px;
          padding: 10px 16px;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444;
          font-size: 13px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

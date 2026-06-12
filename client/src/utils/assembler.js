/**
 * assembler.js — Chunk reassembly and auto-download
 *
 * Receives chunks (Map<index, Uint8Array>), verifies SHA-256 hash,
 * assembles the final file, and triggers a browser download.
 *
 * For large file support (>500MB brownie), we optionally use the
 * Origin Private File System (OPFS) to stream chunks to disk
 * instead of holding everything in RAM.
 */

import { sha256 } from './crypto';

/**
 * Assemble all received chunks into a single Uint8Array.
 * Assumes chunks are indexed 0..totalChunks-1.
 *
 * @param {Map<number, Uint8Array>} chunkMap
 * @param {number} totalChunks
 * @returns {Uint8Array}
 */
export function assembleChunks(chunkMap, totalChunks) {
  // Sort by index and concatenate
  const arrays = [];
  for (let i = 0; i < totalChunks; i++) {
    const chunk = chunkMap.get(i);
    if (!chunk) throw new Error(`Missing chunk at index ${i}`);
    arrays.push(chunk);
  }

  const totalLength = arrays.reduce((acc, arr) => acc + arr.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
}

/**
 * Verify SHA-256 hash of assembled data against the expected hash.
 * @param {Uint8Array} data
 * @param {string} expectedHash - hex string
 * @returns {Promise<boolean>}
 */
export async function verifyHash(data, expectedHash) {
  const actualHash = await sha256(data.buffer);
  return actualHash === expectedHash;
}

/**
 * Trigger a browser file download from a Uint8Array.
 * Creates a temporary object URL and clicks a hidden <a> tag.
 *
 * @param {Uint8Array} data
 * @param {string} fileName
 * @param {string} mimeType
 */
export function triggerDownload(data, fileName, mimeType = 'application/octet-stream') {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Clean up after a short delay to allow download to start
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 5000);
}

// ─── OPFS Large File Support (Brownie) ───────────────────────────────────────

/**
 * Check if OPFS is available in the current browser.
 * @returns {boolean}
 */
export function isOPFSSupported() {
  return (
    'storage' in navigator &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

/**
 * Create an OPFS-backed chunk writer for large files.
 * Returns a writer object with { write(index, data), assemble(fileName) }
 *
 * @param {string} sessionId - unique identifier for this transfer session
 * @returns {Promise<OPFSWriter>}
 */
export async function createOPFSWriter(sessionId) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(`wshare-${sessionId}`, { create: true });
  const chunkHandles = new Map();

  return {
    /**
     * Write a chunk to OPFS.
     * @param {number} index
     * @param {Uint8Array} data
     */
    async write(index, data) {
      const fileHandle = await dir.getFileHandle(`chunk-${index}`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      chunkHandles.set(index, fileHandle);
    },

    /**
     * Read all chunks from OPFS in order, concatenate, and trigger download.
     * @param {string} fileName
     * @param {string} mimeType
     * @param {number} totalChunks
     */
    async assemble(fileName, mimeType, totalChunks) {
      const parts = [];
      for (let i = 0; i < totalChunks; i++) {
        const handle = chunkHandles.get(i);
        if (!handle) throw new Error(`OPFS chunk ${i} not found`);
        const file = await handle.getFile();
        parts.push(await file.arrayBuffer());
      }

      const blob = new Blob(parts, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 5000);

      // Cleanup OPFS directory
      await root.removeEntry(`wshare-${sessionId}`, { recursive: true });
    },
  };
}

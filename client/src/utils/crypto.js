/**
 * crypto.js — Web Crypto API utilities
 *
 * Provides SHA-256 hashing and AES-GCM encryption/decryption
 * for zero-knowledge file transfer (brownie feature).
 * All operations run in the browser — no data touches the server.
 */

// ─── SHA-256 Hashing ─────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of an ArrayBuffer and return it as a hex string.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>} hex-encoded hash
 */
export async function sha256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Convert an ArrayBuffer to a lowercase hex string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── AES-GCM Key Management ──────────────────────────────────────────────────

/**
 * Generate a new AES-GCM 256-bit key.
 * @returns {Promise<CryptoKey>}
 */
export async function generateEncryptionKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable — we need to export it to the URL hash
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to a URL-safe base64 string (for URL hash).
 * @param {CryptoKey} key
 * @returns {Promise<string>} base64url encoded key
 */
export async function exportKeyToBase64(key) {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Import an AES-GCM key from a base64url string (read from URL hash).
 * @param {string} base64Key
 * @returns {Promise<CryptoKey>}
 */
export async function importKeyFromBase64(base64Key) {
  // Restore standard base64 from base64url
  const standardBase64 = base64Key.replace(/-/g, '+').replace(/_/g, '/');
  const rawKey = Uint8Array.from(atob(standardBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable once imported on receiver
    ['decrypt']
  );
}

// ─── AES-GCM Encryption/Decryption ──────────────────────────────────────────

/**
 * Encrypt an ArrayBuffer chunk using AES-GCM.
 * A random 12-byte IV is generated per chunk and prepended to the ciphertext.
 * Format: [12 bytes IV][encrypted data]
 *
 * @param {CryptoKey} key
 * @param {ArrayBuffer} data
 * @returns {Promise<ArrayBuffer>}
 */
export async function encryptChunk(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  // Prepend IV to ciphertext
  const result = new Uint8Array(12 + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), 12);
  return result.buffer;
}

/**
 * Decrypt an AES-GCM encrypted chunk.
 * Expects: [12 bytes IV][encrypted data] format.
 *
 * @param {CryptoKey} key
 * @param {ArrayBuffer} data
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptChunk(key, data) {
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

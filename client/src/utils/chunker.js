/**
 * chunker.js — File chunking pipeline for WebRTC DataChannel transfer
 *
 * Reads a File object and produces ArrayBuffer chunks ready to send.
 * Each chunk has a 4-byte Uint32 header containing its index,
 * followed by the raw binary data.
 *
 * Wire format per chunk:
 *   [4 bytes: chunkIndex (Uint32BE)] [n bytes: raw file slice]
 *
 * The receiver uses the index to reconstruct the file in order,
 * even if chunks arrive out of order (which ordered DataChannels prevent,
 * but we still include the index for robustness and resume support).
 */

export const CHUNK_SIZE = 64 * 1024; // 64 KB — optimal for WebRTC SCTP

/**
 * Calculate total number of chunks for a file.
 * @param {number} fileSize - in bytes
 * @param {number} [chunkSize] - optional override
 * @returns {number}
 */
export function getTotalChunks(fileSize, chunkSize = CHUNK_SIZE) {
  return Math.ceil(fileSize / chunkSize);
}

/**
 * Read a specific chunk of a File as an ArrayBuffer.
 * @param {File} file
 * @param {number} index - 0-based chunk index
 * @param {number} [chunkSize]
 * @returns {Promise<ArrayBuffer>}
 */
export function readChunk(file, index, chunkSize = CHUNK_SIZE) {
  return new Promise((resolve, reject) => {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const slice = file.slice(start, end);

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Pack a chunk index + raw data into a single ArrayBuffer for sending.
 * Format: [4-byte Uint32 index][raw bytes]
 *
 * @param {number} index
 * @param {ArrayBuffer} data - raw file chunk
 * @returns {ArrayBuffer}
 */
export function packChunk(index, data) {
  const packet = new ArrayBuffer(4 + data.byteLength);
  const view = new DataView(packet);
  view.setUint32(0, index, false); // big-endian
  new Uint8Array(packet, 4).set(new Uint8Array(data));
  return packet;
}

/**
 * Unpack a received ArrayBuffer into { index, data }.
 * @param {ArrayBuffer} packet
 * @returns {{ index: number, data: ArrayBuffer }}
 */
export function unpackChunk(packet) {
  const view = new DataView(packet);
  const index = view.getUint32(0, false); // big-endian
  const data = packet.slice(4);
  return { index, data };
}

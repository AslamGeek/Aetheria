import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, r, g, b, innerR, innerG, innerB) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression method
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace method
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with scanline filters (filter byte 0)
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);
  
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.38;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Inner circle / emblem
        const t = dist / radius;
        rawData[pxOffset] = Math.round(innerR * (1 - t) + 99 * t);
        rawData[pxOffset + 1] = Math.round(innerG * (1 - t) + 102 * t);
        rawData[pxOffset + 2] = Math.round(innerB * (1 - t) + 241 * t);
        rawData[pxOffset + 3] = 255;
      } else {
        // Background
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, toCrc, crcBuf]);
}

const pwa192 = createPng(192, 192, 9, 13, 22, 129, 140, 248);
const pwa512 = createPng(512, 512, 9, 13, 22, 99, 102, 241);
const pwaMaskable = createPng(512, 512, 9, 13, 22, 56, 189, 248);
const appleIcon = createPng(180, 180, 9, 13, 22, 129, 140, 248);

if (!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/pwa-192x192.png', pwa192);
fs.writeFileSync('public/pwa-512x512.png', pwa512);
fs.writeFileSync('public/pwa-maskable-512x512.png', pwaMaskable);
fs.writeFileSync('public/apple-touch-icon.png', appleIcon);
fs.writeFileSync('public/favicon.ico', pwa192);

console.log('PWA icons successfully generated.');

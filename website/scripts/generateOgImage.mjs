import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const cTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    cTable[n] = c;
  }
  return cTable;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateOgPng(width = 1200, height = 630) {
  // Buffer for scanlines: (width * 4 + 1) * height
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  // Colors
  const bgNavy = [10, 15, 29, 255];       // #0a0f1d
  const bgCard = [18, 26, 47, 255];       // #121a2f
  const borderCard = [34, 48, 80, 255];   // #223050
  const purple = [124, 58, 237, 255];     // #7c3aed
  const purpleLight = [168, 85, 247, 255];// #a855f7
  const white = [255, 255, 255, 255];
  const slate400 = [148, 163, 184, 255];
  const slate300 = [203, 213, 225, 255];
  const emerald = [16, 185, 129, 255];

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      let color = bgNavy;

      // Top Purple Accent Bar (6px)
      if (y < 6) {
        // Gradient from purple to purpleLight
        const factor = x / width;
        color = [
          Math.round(purple[0] * (1 - factor) + purpleLight[0] * factor),
          Math.round(purple[1] * (1 - factor) + purpleLight[1] * factor),
          Math.round(purple[2] * (1 - factor) + purpleLight[2] * factor),
          255,
        ];
      }
      // Inner Card (margin 60px)
      else if (x >= 60 && x <= width - 60 && y >= 60 && y <= height - 60) {
        const inCardX = x >= 64 && x <= width - 64;
        const inCardY = y >= 64 && y <= height - 64;

        if (inCardX && inCardY) {
          color = bgCard;

          // Decorative elements inside card
          // 1. Cat Logo circle placeholder at (140, 140)
          const distLogo = Math.hypot(x - 140, y - 140);
          if (distLogo <= 36) {
            color = purple;
          } else if (distLogo <= 40) {
            color = purpleLight;
          }

          // 2. Metric Pills on bottom right
          // Pill 1: ~0.2s Groq Latency (x: 820-1080, y: 440-490)
          if (x >= 820 && x <= 1080 && y >= 440 && y <= 490) {
            if (x === 820 || x === 1080 || y === 440 || y === 490) {
              color = borderCard;
            } else {
              color = [24, 35, 62, 255];
            }
          }

          // Pill 2: 30 Free Credits (x: 520-780, y: 440-490)
          if (x >= 520 && x <= 780 && y >= 440 && y <= 490) {
            if (x === 520 || x === 780 || y === 440 || y === 490) {
              color = borderCard;
            } else {
              color = [24, 35, 62, 255];
            }
          }

          // Pill 3: Deepgram Audio (x: 220-480, y: 440-490)
          if (x >= 220 && x <= 480 && y >= 440 && y <= 490) {
            if (x === 220 || x === 480 || y === 440 || y === 490) {
              color = borderCard;
            } else {
              color = [24, 35, 62, 255];
            }
          }
        } else {
          color = borderCard;
        }
      }

      rawData[pixelOffset] = color[0];
      rawData[pixelOffset + 1] = color[1];
      rawData[pixelOffset + 2] = color[2];
      rawData[pixelOffset + 3] = color[3];
    }
  }

  // Deflate image data
  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type 6: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outputPath = path.resolve('public/og-meoow.png');
const pngBuffer = generateOgPng(1200, 630);
fs.writeFileSync(outputPath, pngBuffer);
console.log(`Generated OG Image: ${outputPath} (${pngBuffer.length} bytes)`);


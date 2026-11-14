// Generates the PWA icons as PNG files with no image dependencies: `npm run icons`.
// The picture is the game in miniature: a green lane, a red tower on top, a blue one below.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const NAVY = [27, 42, 65];
const GREEN_FAR = [124, 198, 107];
const GREEN_NEAR = [142, 212, 124];
const RED = [242, 92, 84];
const BLUE = [61, 139, 253];
const GOLD = [255, 209, 102];
const WHITE = [255, 255, 255];

/** Colour of the icon at (u, v), both 0..1 from the top-left. */
function colourAt(u, v) {
  const inSquare = (cx, cy, half) => Math.abs(u - cx) <= half && Math.abs(v - cy) <= half;
  if (inSquare(0.5, 0.27, 0.105)) return RED;
  if (inSquare(0.5, 0.73, 0.105)) return BLUE;
  if (Math.hypot(u - 0.5, v - 0.5) <= 0.055) return GOLD;
  if (Math.abs(u - 0.5) <= 0.24) {
    if (Math.abs(v - 0.5) <= 0.008 && Math.floor(u * 25) % 2 === 0) return WHITE;
    return v < 0.5 ? GREEN_FAR : GREEN_NEAR;
  }
  return NAVY;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(size) {
  const SAMPLES = 3; // 3x3 supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colourAt((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size);
          for (let i = 0; i < 3; i++) sum[i] += c[i];
        }
      }
      for (let i = 0; i < 3; i++) raw[row + 1 + x * 3 + i] = Math.round(sum[i] / (SAMPLES * SAMPLES));
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, png(size));
  console.log(`public/icons/${name}`);
}

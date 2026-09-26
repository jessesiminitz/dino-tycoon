// Generates the PWA / Home Screen icons from a pixel-art grid, with no image
// libraries: a tiny PNG encoder using Node's zlib. Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// 16×16 sauropod on a sunset island. One char per pixel.
const ART = [
  '................',
  '..........GGG...',
  '.........GGEGG..',
  '.........GGGG...',
  '.........GG.....',
  '........GG......',
  '.......GG.......',
  '..GGGGGGG.......',
  '.GGgGGGGGG......',
  'GG.GGGGGGGG.....',
  'G...GgGGgGG.....',
  '....GG.G.GG.....',
  '....GG...GG.....',
  'SSSSSSSSSSSSSSSS',
  'WWWWwWWWWWWwWWWW',
  'WWwWWWWWWwWWWWWW',
];
const PALETTE = {
  '.': [0x27, 0x4e, 0x6b], // sky
  G: [0x6f, 0xb3, 0x4a], // dino
  g: [0x4e, 0x8a, 0x33], // dino shading
  E: [0x1b, 0x1b, 0x1b], // eye
  S: [0xe8, 0xd1, 0x8b], // sand
  W: [0x1f, 0x4e, 0x79], // water
  w: [0x5b, 0xb3, 0xd6], // wave
};

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Icon of `size` px. The art is centred in a safe zone (`padFrac`) for maskable icons. */
function png(size, padFrac) {
  const pad = Math.round(size * padFrac);
  const scale = Math.floor((size - pad * 2) / 16);
  const off = Math.floor((size - scale * 16) / 2);
  const sky = PALETTE['.'];
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const ax = Math.floor((x - off) / scale);
      const ay = Math.floor((y - off) / scale);
      let c = sky;
      if (ax >= 0 && ay >= 0 && ax < 16 && ay < 16) c = PALETTE[ART[ay][ax]];
      else if (ay >= 13) c = ay === 13 ? PALETTE.S : PALETTE.W; // extend ground to the edges
      const i = y * (size * 3 + 1) + 1 + x * 3;
      raw[i] = c[0];
      raw[i + 1] = c[1];
      raw[i + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, 0.1));
writeFileSync('public/icons/icon-512.png', png(512, 0.1));
writeFileSync('public/icons/apple-touch-icon.png', png(180, 0.06));
console.log('Wrote public/icons/{icon-192,icon-512,apple-touch-icon}.png');

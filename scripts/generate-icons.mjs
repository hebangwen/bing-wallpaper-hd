import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function iconPixel(x, y, size) {
  const t = (x + y) / (2 * size);
  const r = lerp(0x0b, 0x00818a >> 16, t);
  const g = lerp(0x4a, (0x00818a >> 8) & 0xff, t);
  const b = lerp(0x6e, 0x00818a & 0xff, t);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.3;
  const dist = Math.hypot(x - cx, y - cy);
  const edge = Math.max(0, Math.min(1, radius - dist));
  const blend = (channel, target) => lerp(channel, target, edge);
  return [blend(r, 255), blend(g, 255), blend(b, 255), 255];
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`../icons/icon${size}.png`, import.meta.url), encodePng(size, iconPixel));
}

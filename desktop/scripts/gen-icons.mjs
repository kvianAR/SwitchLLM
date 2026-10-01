// Generates the desktop icons from the SwitchLLM routing arrows mark without any image dependencies —
// pure-Node PNG encoding (zlib IDAT + hand-rolled CRC32), 4x supersampled.
//
// Outputs:
//   assets/trayTemplate.png      16x16  black-on-transparent (macOS template)
//   assets/trayTemplate@2x.png   32x32
//   assets/appicon_1024.png      full-color app icon (icns built via iconutil)
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(__dirname, '../assets');
fs.mkdirSync(assets, { recursive: true });

// ── PNG encoder ────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── rasterizer ─────────────────────────────────────────────────────────────
// Renders with 4x supersampling. `shapes` is an ordered list painted
// back-to-front; each returns coverage [0..1] at a sample point plus a color.
function render(size, shapes) {
  const SS = 4;
  const S = size * SS;
  const img = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px * SS + sx + 0.5) / S; // normalized [0,1]
          const y = (py * SS + sy + 0.5) / S;
          // composite shapes front-to-back at this sample
          let sr = 0, sg = 0, sb = 0, sa = 0;
          for (const sh of shapes) {
            const cov = sh.cover(x, y);
            if (cov <= 0) continue;
            const [cr, cg, cb, ca] = sh.color;
            const srcA = ca * cov;
            sr = cr * srcA + sr * (1 - srcA);
            sg = cg * srcA + sg * (1 - srcA);
            sb = cb * srcA + sb * (1 - srcA);
            sa = srcA + sa * (1 - srcA);
          }
          r += sr; g += sg; b += sb; a += sa;
        }
      }
      const n = SS * SS;
      const idx = (py * size + px) * 4;
      const alpha = a / n;
      img[idx] = alpha > 0 ? Math.round((r / n / alpha) * 255) : 0;
      img[idx + 1] = alpha > 0 ? Math.round((g / n / alpha) * 255) : 0;
      img[idx + 2] = alpha > 0 ? Math.round((b / n / alpha) * 255) : 0;
      img[idx + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(img, size, size);
}

const segment = (x1, y1, x2, y2, width, color) => ({
  color,
  cover: (x, y) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= width / 2 ? 1 : 0;
  },
});
const roundedRect = (x0, y0, x1, y1, rad, color) => ({
  color,
  cover: (x, y) => {
    const qx = Math.max(x0 + rad - x, 0, x - (x1 - rad));
    const qy = Math.max(y0 + rad - y, 0, y - (y1 - rad));
    if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
    return Math.hypot(qx, qy) <= rad ? 1 : 0;
  },
});

// ── tray template (black on transparent; macOS tints it) ──────────────────
// Slightly chunkier than the 64px favicon so it reads at 16px.
const BLACK = [0, 0, 0, 1];
const trayShapes = [
  segment(0.18, 0.34, 0.79, 0.34, 0.12, BLACK),
  segment(0.79, 0.34, 0.63, 0.19, 0.12, BLACK),
  segment(0.79, 0.34, 0.63, 0.49, 0.12, BLACK),
  segment(0.82, 0.66, 0.21, 0.66, 0.12, BLACK),
  segment(0.21, 0.66, 0.37, 0.51, 0.12, BLACK),
  segment(0.21, 0.66, 0.37, 0.81, 0.12, BLACK),
];
fs.writeFileSync(path.join(assets, 'trayTemplate.png'), render(16, trayShapes));
fs.writeFileSync(path.join(assets, 'trayTemplate@2x.png'), render(32, trayShapes));

// ── app icon (1024, HIG grid: art occupies ~824/1024 rounded rect) ────────
const BG = [0x11 / 255, 0x11 / 255, 0x25 / 255, 1];
const VIOLET = [0x8b / 255, 0x5c / 255, 0xf6 / 255, 1];
const CYAN = [0x22 / 255, 0xd3 / 255, 0xee / 255, 1];
const inset = 100 / 1024, rectR = 180 / 1024;
const appShapes = [
  roundedRect(inset, inset, 1 - inset, 1 - inset, rectR, BG),
  segment(0.27, 0.40, 0.73, 0.40, 0.058, VIOLET),
  segment(0.73, 0.40, 0.61, 0.29, 0.058, VIOLET),
  segment(0.73, 0.40, 0.61, 0.51, 0.058, VIOLET),
  segment(0.73, 0.60, 0.27, 0.60, 0.058, CYAN),
  segment(0.27, 0.60, 0.39, 0.49, 0.058, CYAN),
  segment(0.27, 0.60, 0.39, 0.71, 0.058, CYAN),
];
fs.writeFileSync(path.join(assets, 'appicon_1024.png'), render(1024, appShapes));

console.log('icons written to', assets);

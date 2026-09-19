#!/usr/bin/env node
/**
 * Generates every PWA / favicon asset for 記帳本 from a single vector-ish
 * description of the app mark: an accent squircle holding a ledger card with a
 * bound spine and a "$" mark.
 *
 * Zero runtime dependencies — shapes are rasterised with supersampling and the
 * PNG / ICO containers are written by hand (node:zlib supplies the deflate).
 *
 * Run with `node scripts/generate-icons.mjs` (there is no npm script for it
 * because package.json is owned elsewhere).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// PNG / ICO containers
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(
    crc32(Buffer.concat([Buffer.from(type, "ascii"), data])),
    data.length + 8,
  );
  return out;
}

/** Encodes an RGBA byte buffer as an 8-bit truecolour+alpha PNG. */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1);
    // Filter 2 (Up) keeps the flat background cheap for deflate.
    raw[rowStart] = y === 0 ? 0 : 2;
    for (let x = 0; x < stride; x += 1) {
      const value = rgba[y * stride + x];
      const above = y === 0 ? 0 : rgba[(y - 1) * stride + x];
      raw[rowStart + 1 + x] = (value - above) & 0xff;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Packs PNG payloads into an .ico (PNG-in-ICO, supported since IE11). */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((entry, index) => {
    const at = index * 16;
    dir[at] = entry.size >= 256 ? 0 : entry.size;
    dir[at + 1] = entry.size >= 256 ? 0 : entry.size;
    dir[at + 2] = 0; // palette size
    dir[at + 3] = 0; // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(entry.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  });

  return Buffer.concat([header, dir, ...entries.map((entry) => entry.data)]);
}

// ---------------------------------------------------------------------------
// Palette (mirrors the app's design tokens)
// ---------------------------------------------------------------------------

const ACCENT = [0x0f, 0x7a, 0x5f];
const ACCENT_TOP = [0x18, 0x91, 0x72];
const ACCENT_BOTTOM = [0x0a, 0x60, 0x4b];
const SPINE = [0x09, 0x52, 0x40];
const SURFACE = [0xff, 0xfd, 0xf8];

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

// ---------------------------------------------------------------------------
// Shapes — all predicates take coordinates in their own 0..1 design space
// ---------------------------------------------------------------------------

/** Superellipse, i.e. an iOS-style squircle when exponent ≈ 3.6. */
const squircle = (exponent) => (x, y) =>
  Math.abs(2 * x - 1) ** exponent + Math.abs(2 * y - 1) ** exponent <= 1;

const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

const roundedRect = (x0, y0, x1, y1, r) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
};

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

const norm360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * Ring segment. Angles are degrees measured from east and increase clockwise
 * on screen (y grows downwards); the kept span runs clockwise `from` → `to`.
 */
const arc = (cx, cy, outer, inner, from, to) => {
  const span = norm360(to - from);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > outer * outer || d2 < inner * inner) return false;
    const deg = norm360((Math.atan2(dy, dx) * 180) / Math.PI);
    return norm360(deg - from) <= span;
  };
};

/** A "$": vertical bar plus the two arcs of an S. */
function dollar({ cx, cy, height, stroke, radius, color }) {
  const offset = radius * 0.82;
  const inner = radius - stroke;
  return [
    {
      shape: roundedRect(
        cx - stroke / 2,
        cy - height / 2,
        cx + stroke / 2,
        cy + height / 2,
        stroke / 2,
      ),
      color,
    },
    // Top of the S: a "C" opening to the east.
    { shape: arc(cx, cy - offset, radius, inner, 42, 318), color },
    // Bottom of the S: a mirrored "C" opening to the west.
    { shape: arc(cx, cy + offset, radius, inner, 222, 138), color },
  ];
}

/** The full mark: ledger card, bound spine, spine rings and the "$". */
function ledgerCardOps() {
  const card = roundedRect(0.155, 0.1, 0.845, 0.9, 0.105);
  return [
    { shape: card, color: SURFACE },
    { shape: rect(0.155, 0.1, 0.335, 0.9), color: SPINE, clip: card },
    ...[0.28, 0.5, 0.72].map((y) => ({
      shape: circle(0.2455, y, 0.036, SURFACE),
      color: SURFACE,
    })),
    ...dollar({
      cx: 0.6,
      cy: 0.5,
      height: 0.56,
      stroke: 0.062,
      radius: 0.147,
      color: ACCENT,
    }),
  ];
}

/** Simplified mark for tiny sizes: just the "$", as large as it will go. */
function dollarOnlyOps() {
  return dollar({
    cx: 0.5,
    cy: 0.5,
    height: 0.72,
    stroke: 0.115,
    radius: 0.215,
    color: SURFACE,
  });
}

// ---------------------------------------------------------------------------
// Rasteriser
// ---------------------------------------------------------------------------

const SUPERSAMPLE = 4;

/**
 * @param {number} size            output edge length in px
 * @param {object} options
 * @param {boolean} options.bleed  fill the whole canvas (maskable / apple) instead
 *                                 of drawing a padded squircle
 * @param {number} options.margin  squircle inset, as a fraction, when not bleeding
 * @param {number} options.padding safe-area inset applied to the mark
 * @param {boolean} options.simple use the "$"-only mark
 */
function renderIcon(size, { bleed = false, margin = 0.05, padding = 0, simple = false }) {
  const ops = simple ? dollarOnlyOps() : ledgerCardOps();
  const background = bleed ? null : squircle(3.6);
  const bgOrigin = bleed ? 0 : margin;
  const bgScale = bleed ? 1 : 1 - margin * 2;
  const markOrigin = bgOrigin + bgScale * padding;
  const markScale = bgScale * (1 - padding * 2);

  const samples = size * SUPERSAMPLE;
  const acc = new Float64Array(size * size * 4);

  for (let sy = 0; sy < samples; sy += 1) {
    const v = (sy + 0.5) / samples;
    const py = Math.floor(sy / SUPERSAMPLE);
    const gradient = mix(ACCENT_TOP, ACCENT_BOTTOM, v);

    for (let sx = 0; sx < samples; sx += 1) {
      const u = (sx + 0.5) / samples;

      if (background && !background((u - bgOrigin) / bgScale, (v - bgOrigin) / bgScale)) {
        continue;
      }

      const mx = (u - markOrigin) / markScale;
      const my = (v - markOrigin) / markScale;
      let color = gradient;
      for (const op of ops) {
        if (op.clip && !op.clip(mx, my)) continue;
        if (op.shape(mx, my)) color = op.color;
      }

      const at = (py * size + Math.floor(sx / SUPERSAMPLE)) * 4;
      acc[at] += color[0];
      acc[at + 1] += color[1];
      acc[at + 2] += color[2];
      acc[at + 3] += 255;
    }
  }

  const perPixel = SUPERSAMPLE * SUPERSAMPLE;
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const alpha = acc[i * 4 + 3] / perPixel;
    rgba[i * 4 + 3] = Math.round(alpha);
    if (alpha === 0) continue;
    // Colour was accumulated only over covered samples, so un-premultiply.
    const covered = acc[i * 4 + 3] / 255;
    rgba[i * 4] = Math.round(acc[i * 4] / covered);
    rgba[i * 4 + 1] = Math.round(acc[i * 4 + 1] / covered);
    rgba[i * 4 + 2] = Math.round(acc[i * 4 + 2] / covered);
  }
  return rgba;
}

const png = (size, options) => encodePng(renderIcon(size, options), size);

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

const files = [
  // Manifest "any" icons: padded squircle on transparency.
  ["public/icons/icon-192.png", png(192, { margin: 0.05 })],
  ["public/icons/icon-512.png", png(512, { margin: 0.05 })],
  // Manifest "maskable": full-bleed background, mark inside a 10% safe area.
  ["public/icons/icon-512-maskable.png", png(512, { bleed: true, padding: 0.11 })],
  // iOS home screen: opaque, full-bleed (iOS applies its own rounding).
  ["public/icons/apple-touch-icon-180.png", png(180, { bleed: true, padding: 0.07 })],
  ["src/app/apple-icon.png", png(180, { bleed: true, padding: 0.07 })],
  // Browser tab / bookmarks.
  ["public/icons/favicon-32.png", png(32, { margin: 0.03, simple: true })],
  [
    "src/app/favicon.ico",
    // 32 first: Next reports the first entry's size on the emitted <link>.
    encodeIco(
      [32, 16, 48].map((size) => ({
        size,
        data: png(size, { margin: 0.03, simple: true }),
      })),
    ),
  ],
];

for (const [target, data] of files) {
  const path = join(ROOT, target);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(
    `${relative(ROOT, path).replace(/\\/g, "/")} — ${(data.length / 1024).toFixed(1)} kB`,
  );
}

// Builds the static halftone portrait used when WebGL is unavailable or the
// visitor prefers reduced motion: public/assets/profile-halftone.png
//
// It uses the same recipe as the shader in src/motion/halftone.ts (45° dot
// grid, cream dots on Prussian blue, dot area follows brightness), so the
// fallback and the live effect look the same.
//
// Run after changing the portrait:  npm run halftone
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = new URL("../public/assets/", import.meta.url);
const SOURCE = fileURLToPath(new URL("profile-pic.png", root));
const OUT = fileURLToPath(new URL("profile-halftone.png", root));

const W = 960; // 4:5, matches the hero frame
const H = 1200;
const CELL = 11; // px between dots
// Framing and tone. Keep in sync with PORTRAIT in src/motion/halftone.ts
const ZOOM = 1.5; // crop in past cover-fit
const FOCUS_X = 0.47; // point of the photo kept at the centre of the frame
const FOCUS_Y = 0.6;
const GAMMA = 1.35; // >1 darkens mid-tones so the busy background recedes
const VIGNETTE = 0.45; // how much the edges fade towards blue
const BLUE = [0x1b, 0x2f, 0x5c];
const CREAM = [0xf4, 0xf1, 0xea];

const { data: src, info } = await sharp(SOURCE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// cover-fit the portrait into W×H, horizontally centred on FOCUS_X
const scale = Math.max(W / info.width, H / info.height) * ZOOM;
const clampOff = (v, size, frame) => Math.min(0, Math.max(frame - size, v));
const offX = clampOff(W / 2 - FOCUS_X * info.width * scale, info.width * scale, W);
const offY = clampOff(H / 2 - FOCUS_Y * info.height * scale, info.height * scale, H);

function brightness(x, y) {
  const sx = Math.round((x - offX) / scale);
  const sy = Math.round((y - offY) / scale);
  if (sx < 0 || sy < 0 || sx >= info.width || sy >= info.height) return 0;
  const i = (sy * info.width + sx) * 4;
  const a = src[i + 3] / 255;
  const lum = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
  const v = Math.hypot(x / W - 0.5, (y / H - 0.5) * 0.9) * 2; // 0 centre → ~1 corners
  const fade = 1 - VIGNETTE * smoothstep(0.35, 1.05, v);
  return Math.pow(smoothstep(0.06, 0.94, lum), GAMMA) * a * fade;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const C = Math.SQRT1_2;
const out = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // rotate into the dot grid
    const rx = C * x - C * y;
    const ry = C * x + C * y;
    const cx = (Math.floor(rx / CELL) + 0.5) * CELL;
    const cy = (Math.floor(ry / CELL) + 0.5) * CELL;
    // back to image space for the dot's centre
    const px = C * cx + C * cy;
    const py = -C * cx + C * cy;
    const radius = CELL * 0.5 * 1.1 * Math.sqrt(brightness(px, py));
    const d = Math.hypot(rx - cx, ry - cy);
    const cover = Math.min(1, Math.max(0, radius - d + 0.5)); // 1px anti-aliasing
    const o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(BLUE[c] + (CREAM[c] - BLUE[c]) * cover);
  }
}

await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .png({ palette: true, colors: 32, compressionLevel: 9 })
  .toFile(OUT);
console.log("wrote", OUT);

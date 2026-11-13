// Prepares the About portrait:
//   public/assets/profile.webp            the photo the shader draws (src/motion/halftone.ts)
//   public/assets/profile-halftone.png   the static halftone, shown without WebGL,
//                                         with reduced motion, or until the shader runs
//
// The static version uses the same recipe as the shader (45° dot grid, cream
// dots on Prussian blue, dot area follows brightness), so the two match.
//
// To change the photo:  npm run halftone -- path/to/photo.jpg
// (a clear, front-facing photo, face in the upper half, works best).
// Without an argument it rebuilds from the current public/assets/profile.webp.
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const root = new URL("../public/assets/", import.meta.url);
const PHOTO = fileURLToPath(new URL("profile.webp", root));
const OUT = fileURLToPath(new URL("profile-halftone.png", root));
const source = process.argv[2] ?? PHOTO;

// 1. the photo for the shader: 1200px wide is plenty for the frame's size
if (process.argv[2]) {
  await sharp(source).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(PHOTO);
  console.log("wrote", PHOTO);
}

// 2. the static halftone
const W = 960; // 4:5, matches the frame
const H = 1200;
const CELL = 7; // px between dots (~137 across, like the shader's 150)
// Framing and tone. Keep in sync with PORTRAIT in src/motion/halftone.ts
const ZOOM = 1.15; // crop in past cover-fit
const FOCUS_X = 0.47; // point of the photo kept at the centre of the frame
const FOCUS_Y = 0.55;
const GAMMA = 1.25; // >1 darkens mid-tones so a busy background recedes
const VIGNETTE = 0.35; // how much the edges fade towards blue
const BLUE = [0x1b, 0x2f, 0x5c];
const CREAM = [0xf4, 0xf1, 0xea];

const { data: src, info } = await sharp(PHOTO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// cover-fit the portrait into W×H, centred on FOCUS
const scale = Math.max(W / info.width, H / info.height) * ZOOM;
const clampOff = (v, size, frame) => Math.min(0, Math.max(frame - size, v));
const offX = clampOff(W / 2 - FOCUS_X * info.width * scale, info.width * scale, W);
const offY = clampOff(H / 2 - FOCUS_Y * info.height * scale, info.height * scale, H);

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

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
    const radius = CELL * 0.55 * Math.sqrt(brightness(px, py));
    const d = Math.hypot(rx - cx, ry - cy);
    const cover = Math.min(1, Math.max(0, radius - d + 0.5)); // 1px anti-aliasing
    const o = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(BLUE[c] + (CREAM[c] - BLUE[c]) * cover);
  }
}

// two inks plus their anti-aliased edge: a 4-colour palette keeps it small
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ palette: true, colors: 4, compressionLevel: 9, effort: 10 }).toFile(OUT);
console.log("wrote", OUT);

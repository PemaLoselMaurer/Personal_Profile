// Cuts Hokusai's print into the depth layers of the 3D world (src/motion/world.ts).
//
//   sky     the paper sky, with the sea painted out (opaque)
//   fuji    the mountain. It reaches down behind the sea so its base never
//           shows a gap when the layers move apart.
//   back    the far sea, the right-hand swell and the boats, with only the
//           mountain's silhouette cut out. Where the front layer will sit it
//           holds a soft, darkened copy of the sea, so moving the layers apart
//           reveals the body of the wave rather than holes.
//   front   the great wave, its crest and the foreground mound
//   print   all of it flattened: the fallback image without WebGL
//
// Source (public domain, The Met Open Access):
//   https://images.metmuseum.org/CRDImages/as/original/DP130155.jpg
// Usage:
//   node scripts/cut-layers.cjs <source.jpg> [outDir=public/assets/wave] [--preview]
//
// The sky is found by flood-filling paper from the top edge, with printed
// lines and blue ink acting as walls. Polygons are in fractions of the print
// (x right, y down) and were read off a gridded copy of the scan.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
const outDir = args.filter((a) => !a.startsWith("--"))[1] ?? path.join(__dirname, "../public/assets/wave");
const preview = args.includes("--preview");
if (!source) {
  console.error("usage: node scripts/cut-layers.cjs <source.jpg> [outDir] [--preview]");
  process.exit(1);
}

const W = 2400; // working width
const SIZES = [2000, 1000]; // output widths

const P = {
  inkYellow: 2, // r - b below this counts as blue ink
  inkLum: 90, // or darker than this
  wallGrow: 3, // px the walls are thickened to close gaps in outlines
  inpaintPasses: 90,
  grain: 9,
  // cartouche and signature, painted out of the sky
  erase: [[0.04, 0.05, 0.1, 0.295], [0.015, 0.15, 0.045, 0.33]],
  front: [[0, 0], [0.62, 0], [0.62, 0.44], [0.455, 0.47], [0.465, 0.64], [0.43, 0.7], [0.4, 0.76], [0.38, 0.86], [0.36, 1], [0, 1]],
  // the mountain layer (extends below the waterline, hidden behind the sea)
  fuji: [[0.55, 0.725], [0.6, 0.68], [0.627, 0.645], [0.643, 0.645], [0.67, 0.68], [0.71, 0.722], [0.71, 0.765], [0.55, 0.765]],
  // what is cut out of the back layer: the mountain above the waterline only
  // below this line the mountain layer is a flat foot in shadow blue, so a
  // parallax shift reveals more mountain rather than a second copy of the boat
  fujiBase: 0.732, // just below where the back layer turns opaque
  fujiFoot: [0.606, 0.698],
  footColor: [38, 58, 96], // x range of the mountain's foot
  fujiHole: [[0.59, 0.722], [0.606, 0.69], [0.627, 0.645], [0.643, 0.645], [0.67, 0.68], [0.7, 0.718], [0.7, 0.724], [0.59, 0.726]],
  // the hidden body of the wave is tinted toward the print's indigo
  fillTint: [44, 74, 122],
  fillTintAmount: 0.55
};

(async () => {
  const { data, info } = await sharp(source).resize({ width: W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const H = info.height;
  const N = W * H;

  // box filter on a 0/1 mask via an integral image; out = 1 where the local mean > thresh
  const majority = (src, radius, thresh) => {
    const out = new Uint8Array(N);
    const I = new Uint32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) {
        row += src[y * W + x];
        I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
      }
    }
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - radius), y1 = Math.min(H, y + radius + 1);
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - radius), x1 = Math.min(W, x + radius + 1);
        const sum = I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
        out[y * W + x] = sum > thresh * (x1 - x0) * (y1 - y0) ? 1 : 0;
      }
    }
    return out;
  };

  const flood = (src, value, seeds) => {
    const seen = new Uint8Array(N);
    const stack = [];
    for (const s of seeds) if (src[s] === value && !seen[s]) { seen[s] = 1; stack.push(s); }
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      if (x > 0 && src[i - 1] === value && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); }
      if (x < W - 1 && src[i + 1] === value && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && src[i - W] === value && !seen[i - W]) { seen[i - W] = 1; stack.push(i - W); }
      if (y < H - 1 && src[i + W] === value && !seen[i + W]) { seen[i + W] = 1; stack.push(i + W); }
    }
    return seen;
  };

  const gray = (buf, blur) =>
    sharp(buf, { raw: { width: W, height: H, channels: 1 } }).blur(blur).extractChannel(0).raw().toBuffer();

  // soft polygon mask, 0..255
  const polygon = async (points, feather) => {
    const d = points.map(([x, y], i) => `${i ? "L" : "M"}${(x * W).toFixed(1)},${(y * H).toFixed(1)}`).join("") + "Z";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%"/><path d="${d}" fill="#fff"/></svg>`;
    return sharp(Buffer.from(svg)).blur(feather).extractChannel(0).raw().toBuffer();
  };

  // ---- 1. sea mask: everything not reachable from the top as open paper --
  const inkRaw = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    inkRaw[i] = r - b < P.inkYellow || lum < P.inkLum ? 1 : 0;
  }
  const ink = majority(inkRaw, P.wallGrow, 0.01);
  const top = Array.from({ length: W }, (_, x) => x);
  const openSky = flood(ink, 0, top);
  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) mask[i] = openSky[i] ? 0 : 1;
  const bottom = Array.from({ length: W }, (_, x) => (H - 1) * W + x);
  mask = flood(mask, 1, bottom);
  mask = majority(mask, P.wallGrow, 0.985); // take the wall thickening back off

  const maskBuf = Buffer.alloc(N);
  for (let i = 0; i < N; i++) maskBuf[i] = mask[i] * 255;
  const seaAlpha = await gray(maskBuf, 1.1);

  // ---- 2. sky: paint the sea (and the cartouche) out ------------------------
  const unknown = majority(mask, 4, 0.02);
  for (const [x0, y0, x1, y1] of P.erase) {
    for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y++)
      for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x++) unknown[y * W + x] = 1;
  }
  const sky = new Float32Array(N * 3);
  const known = new Uint8Array(N);
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < N; i++) {
    if (unknown[i]) continue;
    known[i] = 1;
    for (let c = 0; c < 3; c++) {
      sky[i * 3 + c] = data[i * 3 + c];
      sum[c] += data[i * 3 + c];
    }
    count++;
  }
  let frontier = [];
  for (let i = 0; i < N; i++) if (!known[i]) frontier.push(i);
  for (let pass = 0; pass < P.inpaintPasses && frontier.length; pass++) {
    const next = [], filled = [];
    for (const i of frontier) {
      const x = i % W, y = (i / W) | 0;
      let n = 0;
      const acc = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (known[j]) { n++; acc[0] += sky[j * 3]; acc[1] += sky[j * 3 + 1]; acc[2] += sky[j * 3 + 2]; }
        }
      if (n >= 2) filled.push([i, acc[0] / n, acc[1] / n, acc[2] / n]);
      else next.push(i);
    }
    for (const [i, r, g, b] of filled) { sky[i * 3] = r; sky[i * 3 + 1] = g; sky[i * 3 + 2] = b; known[i] = 1; }
    frontier = next;
  }
  for (const i of frontier) for (let c = 0; c < 3; c++) sky[i * 3 + c] = sum[c] / count;
  const skyBuf = Buffer.alloc(N * 3);
  for (let i = 0; i < N * 3; i++) skyBuf[i] = Math.max(0, Math.min(255, Math.round(sky[i])));
  const skyBlur = await sharp(skyBuf, { raw: { width: W, height: H, channels: 3 } }).blur(14).raw().toBuffer();
  const unknownBuf = Buffer.alloc(N);
  for (let i = 0; i < N; i++) unknownBuf[i] = unknown[i] * 255;
  const soft = await gray(unknownBuf, 3);
  let seed = 7;
  const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * P.grain;
  for (let i = 0; i < N; i++) {
    const t = soft[i] / 255;
    if (!t) continue;
    const n = noise();
    for (let c = 0; c < 3; c++) {
      const v = skyBuf[i * 3 + c] * (1 - t) + (skyBlur[i * 3 + c] + n) * t;
      skyBuf[i * 3 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }

  // ---- 3. split the sea: front, fuji, back ---------------------------------
  const frontM = await polygon(P.front, 2);
  const fujiM = await polygon(P.fuji, 1.5);
  const holeM = await polygon(P.fujiHole, 1.2);

  // blurred sea (premultiplied), used to fill the back layer under the front
  const premul = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const a = seaAlpha[i] / 255;
    for (let c = 0; c < 3; c++) premul[i * 4 + c] = Math.round(data[i * 3 + c] * a);
    premul[i * 4 + 3] = seaAlpha[i];
  }
  const fill = await sharp(premul, { raw: { width: W, height: H, channels: 4 } }).blur(28).raw().toBuffer();

  const layer = () => Buffer.alloc(N * 4);
  const front = layer(), fuji = layer(), back = layer(), print = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    const a = seaAlpha[i] / 255;
    const f = frontM[i] / 255;
    const j = (fujiM[i] / 255) * (1 - f);
    const hole = (holeM[i] / 255) * (1 - f);
    const o = i * 4;
    for (let c = 0; c < 3; c++) {
      front[o + c] = data[i * 3 + c];
      const baseRow = Math.round(P.fujiBase * H);
      fuji[o + c] = ((i / W) | 0) > baseRow ? P.footColor[c] : data[i * 3 + c];
      // back: the real sea outside the front cut, blurred sea inside it
      const fa = fill[o + 3] / 255;
      const blurred = fa > 0.05 ? Math.min(255, fill[o + c] / fa) : data[i * 3 + c];
      const shaded = blurred + (P.fillTint[c] - blurred) * P.fillTintAmount;
      back[o + c] = Math.round(data[i * 3 + c] * (1 - f) + shaded * f);
      print[i * 3 + c] = Math.round(skyBuf[i * 3 + c] * (1 - a) + data[i * 3 + c] * a);
    }
    front[o + 3] = Math.round(255 * a * f);
    const x = (i % W) / W;
    const belowBase = ((i / W) | 0) > Math.round(P.fujiBase * H);
    const offFoot = belowBase && (x < P.fujiFoot[0] || x > P.fujiFoot[1]);
    fuji[o + 3] = offFoot ? 0 : Math.round(255 * (belowBase ? j : a * hole));
    // under the front cut, the fill is a soft mass held well inside the wave's
    // outline, so separating the layers never shows a ghost of the silhouette
    const t = Math.min(1, Math.max(0, (fill[o + 3] / 255 - 0.75) / 0.23));
    // only low down, where the front cut meets the sea; up in the wave's face
    // the hollow behind it is sky, which is what should show
    const yf = ((i / W) | 0) / H;
    const low = Math.min(1, Math.max(0, (yf - 0.56) / 0.1));
    const inner = t * t * (3 - 2 * t) * low;
    back[o + 3] = Math.round(255 * (a * (1 - f) + inner * f) * (1 - hole));
  }

  // ---- 4. write --------------------------------------------------------------
  fs.mkdirSync(outDir, { recursive: true });
  const rgba = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });
  const rgb = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } });
  const outputs = {
    // tuned by eye for a soft woodblock print on screen; lower costs grain
    sky: [rgb(skyBuf), { quality: 58 }],
    print: [rgb(print), { quality: 64 }],
    back: [rgba(back), { quality: 62, alphaQuality: 72 }],
    front: [rgba(front), { quality: 64, alphaQuality: 76 }],
    fuji: [rgba(fuji).extract({ left: 0, top: 0, width: W, height: H }), { quality: 66, alphaQuality: 76 }]
  };
  for (const [name, [img, opts]] of Object.entries(outputs)) {
    for (const size of SIZES) {
      const file = path.join(outDir, `${name}-${size}.webp`);
      await img.clone().resize({ width: size }).webp({ ...opts, effort: 6, smartSubsample: true }).toFile(file);
      console.log(path.basename(file), Math.round(fs.statSync(file).size / 1024) + " KB");
    }
  }
  console.log("aspect", (W / H).toFixed(4));

  if (preview) {
    // layers pulled apart, on magenta, to check the cuts by eye
    const pv = path.join(outDir, "_preview");
    fs.mkdirSync(pv, { recursive: true });
    for (const name of ["back", "front", "fuji"]) {
      await outputs[name][0].clone().flatten({ background: "#ff00ff" }).resize({ width: 1100 }).jpeg().toFile(path.join(pv, name + ".jpg"));
    }
  }
})();

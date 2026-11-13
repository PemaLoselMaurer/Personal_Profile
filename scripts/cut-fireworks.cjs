// Cuts Kobayashi Kiyochika's "Fireworks at Ikenohata" (1881) into the depth
// layers of the dark-theme world (src/motion/world.ts):
//
//   night-back       sky, pond, far shore and the tree, with the fireworks,
//                    lanterns and crowd painted out (opaque)
//   night-fireworks  the falling fireworks, to sparkle
//   night-lanterns   the five paper lanterns, to flicker
//   night-crowd      the crowd in silhouette along the bottom
//   night-print      all of it flattened: the fallback image without WebGL
//
// Every layer is colour-graded to sit with the site: the grey-green darks
// are tinted toward Prussian blue, and the fireworks and lanterns are lifted.
//
// Source (public domain, The Met Open Access, object 712976):
//   https://www.metmuseum.org/art/collection/search/712976
// Usage:
//   node scripts/cut-fireworks.cjs <source.jpg> [outDir=public/assets/night] [--preview]
//
// The silhouettes are too close in tone to the sky to find automatically, so
// the shapes are measured by hand off a gridded copy of the print. Fractions
// are of the printed area (x right, y down).
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const [source] = files;
const outDir = files[1] ?? path.join(__dirname, "../public/assets/night");
const preview = args.includes("--preview");
if (!source) {
  console.error("usage: node scripts/cut-fireworks.cjs <source.jpg> [outDir] [--preview]");
  process.exit(1);
}

const P = {
  // the printed area inside the scan's paper margins, in source pixels
  crop: { left: 234, top: 258, width: 3544, height: 2309 },
  W: 2000,
  sizes: [2000, 1000],
  // fireworks: bright ink inside this box
  fireworksBox: [0.53, 0.015, 0.82, 0.48],
  // brighter than the surrounding sky by this much
  fireworksLift: 16,
  // lanterns: centre x, centre y, radius x (of width), radius y (of height)
  lanterns: [
    [0.074, 0.552, 0.026, 0.05],
    [0.221, 0.533, 0.025, 0.048],
    [0.495, 0.548, 0.026, 0.05],
    [0.713, 0.574, 0.026, 0.05],
    [0.888, 0.58, 0.026, 0.05]
  ],
  // crowd: a head every so often along this line, and solid below
  crowd: { headY: 0.875, headR: 0.03, step: 0.05, from: 0.02, to: 0.99, solidFrom: 0.9 }
};

(async () => {
  const { data, info } = await sharp(source).extract(P.crop).resize({ width: P.W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const N = W * H;
  const lum = (i) => 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];

  const svgMask = async (body, blur) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%"/>${body}</svg>`;
    return sharp(Buffer.from(svg)).blur(blur).extractChannel(0).raw().toBuffer();
  };

  // ---- masks ----------------------------------------------------------------
  const lanternM = await svgMask(
    P.lanterns.map(([x, y, rx, ry]) => `<ellipse cx="${x * W}" cy="${y * H}" rx="${rx * W}" ry="${ry * H}" fill="#fff"/>`).join(""),
    1.5
  );

  const heads = [];
  for (let x = P.crowd.from; x <= P.crowd.to; x += P.crowd.step)
    heads.push(`<circle cx="${x * W}" cy="${P.crowd.headY * H}" r="${P.crowd.headR * W}" fill="#fff"/>`);
  const crowdM = await svgMask(heads.join("") + `<rect x="0" y="${P.crowd.solidFrom * H}" width="${W}" height="${H}" fill="#fff"/>`, 2);

  const fwRaw = Buffer.alloc(N);
  const [bx0, by0, bx1, by1] = P.fireworksBox;
  const sky = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).blur(45).raw().toBuffer();
  const skyLum = (i) => 0.299 * sky[i * 3] + 0.587 * sky[i * 3 + 1] + 0.114 * sky[i * 3 + 2];
  for (let i = 0; i < N; i++) {
    const x = (i % W) / W;
    const y = ((i / W) | 0) / H;
    fwRaw[i] = x > bx0 && x < bx1 && y > by0 && y < by1 && lum(i) > skyLum(i) + P.fireworksLift ? 255 : 0;
  }
  const fireworksM = await sharp(fwRaw, { raw: { width: W, height: H, channels: 1 } }).median(3).erode(4) /* sharp: erode grows white */.blur(1.5).extractChannel(0).raw().toBuffer();

  // ---- grade (after the masks, which are found on the original tones) -------
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < N; i++) {
    const c = [data[i * 3] / 255, data[i * 3 + 1] / 255, data[i * 3 + 2] / 255];
    const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const shadow = (1 - smooth(0.1, 0.55, l)) * 0.65; // how far toward Prussian
    const light = smooth(0.35, 0.75, l); // fireworks, lanterns, reflections
    const tint = [0.75, 0.95, 1.45]; // Prussian, relative to grey
    for (let k = 0; k < 3; k++) {
      let v = c[k] + (l * tint[k] - c[k]) * shadow;
      v = l + (v - l) * (1 + 0.35 * light); // richer colour in the lights
      v *= 1 + 0.12 * light; // and a little brighter
      data[i * 3 + k] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
  }

  // ---- back: everything cut out is painted over with its surroundings ----------
  const cutAll = Buffer.alloc(N);
  for (let i = 0; i < N; i++) cutAll[i] = Math.max(lanternM[i], crowdM[i], fireworksM[i]);
  // colour + coverage; sharp blurs with premultiplied alpha and returns
  // straight colour, so the blurred colour can be used as it is
  const masked = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < 3; c++) masked[i * 4 + c] = data[i * 3 + c];
    masked[i * 4 + 3] = 255 - cutAll[i];
  }
  const around = await sharp(masked, { raw: { width: W, height: H, channels: 4 } }).blur(30).raw().toBuffer();
  // behind the crowd: the silhouettes' own average dark, so moving the crowd
  // layer shows more crowd rather than a seam
  const crowdMean = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (crowdM[i] < 250 || ((i / W) | 0) < P.crowd.solidFrom * H) continue;
    for (let c = 0; c < 3; c++) crowdMean[c] += data[i * 3 + c];
    n++;
  }
  for (let c = 0; c < 3; c++) crowdMean[c] /= n;
  const back = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    const t = cutAll[i] / 255;
    const k = crowdM[i] / 255;
    const a = around[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) {
      const near = a > 0.05 ? around[i * 4 + c] : crowdMean[c];
      const fill = near * (1 - k) + crowdMean[c] * k;
      back[i * 3 + c] = Math.round(data[i * 3 + c] * (1 - t) + fill * t);
    }
  }

  const layer = (mask) => {
    const out = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) {
      for (let c = 0; c < 3; c++) out[i * 4 + c] = data[i * 3 + c];
      out[i * 4 + 3] = mask[i];
    }
    return sharp(out, { raw: { width: W, height: H, channels: 4 } });
  };

  // ---- write --------------------------------------------------------------
  fs.mkdirSync(outDir, { recursive: true });
  const outputs = {
    // tuned by eye: the dark ground hides compression; the sparks need a bit more
    "night-back": [sharp(back, { raw: { width: W, height: H, channels: 3 } }), { quality: 58 }],
    "night-fireworks": [layer(fireworksM), { quality: 70, alphaQuality: 80 }],
    "night-lanterns": [layer(lanternM), { quality: 70, alphaQuality: 80 }],
    "night-crowd": [layer(crowdM), { quality: 58, alphaQuality: 72 }],
    "night-print": [sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 3 } }), { quality: 64 }]
  };
  for (const [name, [img, opts]] of Object.entries(outputs)) {
    for (const size of P.sizes) {
      const file = path.join(outDir, `${name}-${size}.webp`);
      await img.clone().resize({ width: size }).webp({ ...opts, effort: 6, smartSubsample: true }).toFile(file);
      console.log(path.basename(file), Math.round(fs.statSync(file).size / 1024) + " KB");
    }
  }
  console.log("aspect", (W / H).toFixed(4), "height at 2000:", H);

  if (preview) {
    const pv = path.join(outDir, "_preview");
    fs.mkdirSync(pv, { recursive: true });
    for (const name of ["night-back", "night-fireworks", "night-lanterns", "night-crowd"]) {
      await outputs[name][0].clone().flatten({ background: "#ff00ff" }).resize({ width: 1000 }).jpeg().toFile(path.join(pv, name + ".jpg"));
    }
  }
})();

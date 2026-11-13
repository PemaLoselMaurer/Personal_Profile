// The 3D world behind the page: a woodblock print cut into depth layers and
// rebuilt as a small diorama in WebGL (OGL). There are two:
//
//   light theme  Hokusai, "Under the Wave off Kanagawa"    (scripts/cut-layers.cjs)
//   dark theme   Kiyochika, "Fireworks at Ikenohata"        (scripts/cut-fireworks.cjs)
//
// The print runs behind the whole page. Sections sit on a see-through veil of
// their own colour (styles/motion.css) so the text stays readable; the hero
// and three passages between sections, each carrying one line of the story
// (content.story / storyDark), show it fully. In each passage the camera
// travels from one shot to the next as you scroll through it, and holds
// there through the sections that follow:
//
//   moment                       wave (light)             fireworks (dark)
//   hero                         the whole print          the whole print
//   after About                  crest → the crew         fireworks → the climber
//   before Projects              left → right boat        left → right lantern
//   before Contact               wide → Fuji at night     wide → the crowd
//
// Shots stay wide (about 1.5× at most) so the print never goes soft, and
// every frame is clamped inside the print's edges.
//
// Loading: the flat print shows in the hero straight away; the world fades
// in over it whenever its textures arrive. Only the current theme's print
// loads up front; the other loads when the theme is switched, or in the
// background on fast connections. If the WebGL context is lost, the world
// removes itself and the flat print comes back.
//
// Switching theme dithers one print into the other. At night the fireworks
// sparkle, the lanterns flicker and now and then a new burst lights the sky.
import { Renderer, Camera, Transform, Plane, Program, Mesh, Texture } from "ogl";

// ---- shared scale --------------------------------------------------------------

const PRINT_W = 16; // world units
const HOME_Z = 20; // home camera distance; layers are scaled to line up from here
const layerScale = (z: number) => (HOME_Z - z) / HOME_Z;

interface Shot {
  pos: [number, number, number];
  look: [number, number, number];
  /** Wave only: 0 = the print's own colours, 1 = moonlit Prussian night */
  night: number;
}

interface Layer {
  /** Image file, relative to the site root, with {size} for the width. */
  file: string;
  z: number;
  sky?: boolean;
  /** The layer breathes (vertex sway). */
  sway?: number;
  /** How much a new firework burst lights this layer. */
  flash?: number;
  /** Fireworks: the ink shimmers. */
  sparkle?: number;
  /** Lanterns: a candle flicker. */
  flicker?: number;
}

/** An edge the camera must never see past, at a layer's depth. */
interface Edge {
  z: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

interface World {
  aspect: number;
  layers: Layer[];
  shots: Record<string, Shot>;
  edges: Edge[];
  /** Re-ink the print as night where shots ask for it (stars included). */
  regrade: boolean;
  /** Has fireworks: bursts, sparkle and lantern flicker. */
  fireworks: boolean;
  /** Colour of the sky plane beyond the print's edges. */
  paper: number[];
}

// ---- the two prints --------------------------------------------------------------

const WAVE: World = (() => {
  const aspect = 1.4879;
  const H = PRINT_W / aspect;
  return {
    aspect,
    regrade: true,
    fireworks: false,
    paper: [0.92, 0.85, 0.72],
    layers: [
      { file: "assets/wave/sky-{size}.webp", z: -10, sky: true },
      // Fuji sits just behind the sea: any deeper and close shots look under
      // the waterline at its foot. The sky behind it carries the sense of distance.
      { file: "assets/wave/fuji-{size}.webp", z: -4.25 },
      { file: "assets/wave/back-{size}.webp", z: -4 },
      { file: "assets/wave/front-{size}.webp", z: -1.5, sway: 1 }
    ],
    /**
     * Landmarks, each on its layer: crest (-1.4, 4.1, -1.5) · the crew's boat
     * in the great wave (-6, -1.4, -1.5) · bottom boat (1.3, -4.6, -4) ·
     * right-hand boat (5.4, -2.1, -4) · Fuji (2.6, -2.2, -4.25).
     * Zoom on a layer is (HOME_Z - layer z) / distance: keep it under ~1.6.
     */
    shots: {
      home: { pos: [0, 0, HOME_Z], look: [0, 0, 0], night: 0 },
      crest: { pos: [-0.6, 1.6, 14.4], look: [-0.6, 1.9, -1.5], night: 0 },
      crew: { pos: [-5.2, -0.8, 12], look: [-5.8, -1.3, -1.5], night: 0.12 },
      wave: { pos: [0.2, 0.5, 18], look: [0.2, 0.2, -1.5], night: 0.85 },
      boatLeft: { pos: [-5.2, -0.9, 12.6], look: [-5.8, -1.4, -1.5], night: 1 },
      boatCentre: { pos: [1.3, -3.4, 12], look: [1.3, -4.3, -4], night: 1 },
      boatRight: { pos: [4.6, -1.5, 12], look: [5.3, -2.1, -4], night: 1 },
      fuji: { pos: [2.4, -1.2, 12.5], look: [2.6, -1.9, -4.25], night: 1 }
    },
    // the front layer's left and bottom, the back layer's right and bottom,
    // and the top of the sky
    edges: [
      { z: -1.5, left: (-PRINT_W / 2) * layerScale(-1.5), bottom: (-H / 2) * layerScale(-1.5) },
      { z: -4, right: (PRINT_W / 2) * layerScale(-4), bottom: (-H / 2) * layerScale(-4) },
      { z: -10, top: (H / 2) * layerScale(-10) }
    ]
  };
})();

const NIGHT: World = (() => {
  const aspect = 1.5349;
  const H = PRINT_W / aspect;
  return {
    aspect,
    regrade: false,
    fireworks: true,
    paper: [0.22, 0.24, 0.23],
    layers: [
      { file: "assets/night/night-back-{size}.webp", z: -10, sky: true, flash: 0.1 },
      { file: "assets/night/night-fireworks-{size}.webp", z: -7, flash: 0.9, sparkle: 1 },
      { file: "assets/night/night-lanterns-{size}.webp", z: -3.5, flash: 0.08, flicker: 1 },
      { file: "assets/night/night-crowd-{size}.webp", z: -1.2, flash: 0.05 }
    ],
    /**
     * Landmarks, each on its layer: fireworks (3.5, 4.2, -7) · the climber in
     * the tree (-4.8, 1.6, -10) · lanterns along y -0.6 at z -3.5: left
     * (-8, -0.6), middle (-0.1, -0.6), right (7.3, -0.7) · crowd (y -4.4, -1.2).
     */
    shots: {
      home: { pos: [0, 0, HOME_Z], look: [0, 0, 0], night: 0 },
      crest: { pos: [3, 3.4, 12], look: [3.4, 3.9, -7], night: 0 },
      crew: { pos: [-3.6, 1, 10], look: [-4.6, 1.4, -10], night: 0 },
      wave: { pos: [0.4, 0.6, 18], look: [0.4, 0.6, -5], night: 0 },
      boatLeft: { pos: [-6.6, -0.4, 11], look: [-7.6, -0.6, -3.5], night: 0 },
      boatCentre: { pos: [-0.1, -0.3, 11], look: [-0.1, -0.6, -3.5], night: 0 },
      boatRight: { pos: [6.3, -0.4, 11], look: [7.2, -0.7, -3.5], night: 0 },
      fuji: { pos: [1.8, 0.4, 15], look: [2.2, 1.2, -7], night: 0 }
    },
    // the back's four edges, and the crowd's sides and bottom
    edges: [
      { z: -10, left: (-PRINT_W / 2) * layerScale(-10), right: (PRINT_W / 2) * layerScale(-10), top: (H / 2) * layerScale(-10), bottom: (-H / 2) * layerScale(-10) },
      { z: -1.2, left: (-PRINT_W / 2) * layerScale(-1.2), right: (PRINT_W / 2) * layerScale(-1.2), bottom: (-H / 2) * layerScale(-1.2) }
    ]
  };
})();


const CREAM = [0xf4 / 255, 0xf1 / 255, 0xea / 255];
const DEEP = [0x0f / 255, 0x19 / 255, 0x2e / 255]; // dark-theme page
const BLUE = [0x1b / 255, 0x2f / 255, 0x5c / 255];
/** If the night print isn't loaded yet, the dark theme shows the wave at least this moonlit. */
const DARK_THEME_NIGHT = 0.62;

// ---- shaders -------------------------------------------------------------------

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uSway;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // the front wave breathes: a slow lift, stronger towards the crest
    p.y += uSway * sin(uTime * 0.6) * 0.06 * uv.y;
    p.x += uSway * sin(uTime * 0.45 + 1.3) * 0.04 * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform sampler2D tMap;
  uniform float uSky;         // 1 for the sky layer
  uniform float uUvScale;     // the sky plane is larger than the print
  uniform vec3 uPaper;
  uniform float uNight;
  uniform float uMoon;        // brightness of moonlit highlights
  uniform float uReveal;
  uniform float uFlash;       // a new firework burst, 0..1
  uniform float uFlashGain;   // how much this layer lights up
  uniform float uSparkle;     // fireworks layer: shimmering ink
  uniform float uFlicker;     // lanterns: candle flicker, -1..1
  uniform float uFlickerGain;
  uniform float uDpr;
  uniform float uTime;
  uniform vec3 uBlue;
  uniform vec3 uCream;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    // dithered reveal (same recipe as the portrait's dissolve)
    float n = mix(bayer8(gl_FragCoord.xy / (2.0 * uDpr)), valueNoise(gl_FragCoord.xy / (70.0 * uDpr)), 0.55);
    if (n > uReveal * 1.2 - 0.1) discard;

    vec2 uv = (vUv - 0.5) * uUvScale + 0.5;
    vec4 c;
    if (uSky > 0.5) {
      // the print's sky in the middle, plain paper beyond its edges
      vec2 outside = max(vec2(0.0), abs(uv - 0.5) - 0.5);
      vec3 t = texture2D(tMap, clamp(uv, 0.001, 0.999)).rgb;
      c = vec4(mix(t, uPaper, smoothstep(0.0, 0.12, length(outside))), 1.0);
    } else {
      c = texture2D(tMap, uv);
    }
    if (c.a < 0.004) discard;

    // night: the print re-inked in Prussian blue, highlights as moonlight
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 moon = mix(uBlue * 0.42, mix(uBlue, uCream, uMoon), smoothstep(0.1, 0.95, l));
    vec3 col = mix(c.rgb, moon, uNight);

    // stars, in the upper sky only, square like dither pixels
    if (uSky > 0.5 && uNight > 0.01) {
      vec2 cell = floor(uv * vec2(1100.0, 740.0));
      float h = hash(cell);
      float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + h * 2.5) + h * 50.0);
      float star = step(0.9965, h) * twinkle * smoothstep(0.42, 0.62, uv.y);
      col = mix(col, uCream, star * uNight);
    }

    // fireworks: sparks drift down through the ink and shimmer
    if (uSparkle > 0.0) {
      float s = valueNoise(uv * vec2(90.0, 55.0) + vec2(0.0, uTime * 1.6));
      float glint = smoothstep(0.62, 0.95, s);
      col *= mix(1.0, 0.72 + 0.5 * s, uSparkle);
      col = mix(col, vec3(1.0, 0.9, 0.7), glint * 0.35 * uSparkle);
    }
    // lanterns: candlelight
    col *= 1.0 + uFlicker * uFlickerGain * 0.14;
    // a new burst lights the night
    col = mix(col, vec3(1.0, 0.86, 0.66), clamp(uFlash * uFlashGain, 0.0, 1.0));

    gl_FragColor = vec4(col, c.a);
  }
`;

// ---- scroll track ----------------------------------------------------------------

interface Key {
  y: number;
  value: number[];
}

/** Value at scroll position y, eased between the surrounding keys. */
function sample(keys: Key[], y: number): number[] {
  if (y <= keys[0].y) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (y <= b.y) {
      const span = b.y - a.y;
      let t = span > 0 ? (y - a.y) / span : 1;
      t = t * t * (3 - 2 * t); // ease in and out between shots
      return a.value.map((v, k) => v + (b.value[k] - v) * t);
    }
  }
  return keys[keys.length - 1].value;
}

const shotValue = (s: Shot) => [...s.pos, ...s.look, s.night];

/** A firework burst: a quick bloom, then a long glow. dt in seconds. */
function burstCurve(dt: number): number {
  if (dt < 0) return 0;
  const bloom = Math.min(1, dt / 0.08);
  return bloom * Math.exp(-Math.max(0, dt - 0.08) * 2.2);
}

// ---- setup -------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img.decode().then(() => img);
}

/**
 * Texture width for this screen. Must match the <link rel="preload">
 * imagesrcset/imagesizes in layouts/Base.astro so the preloaded file is the
 * one used: 1000w when the image needs at most 1000 device pixels.
 */
export function textureSize(): 1000 | 2000 {
  const cssWidth = window.innerWidth <= 600 ? window.innerWidth * 0.34 : window.innerWidth;
  return cssWidth * (window.devicePixelRatio || 1) > 1000 ? 2000 : 1000;
}

interface Built {
  world: World;
  scene: Transform;
  /** Per-world uniforms (shared by its layers). */
  u: { uReveal: { value: number }; uNight: { value: number }; uFlash: { value: number }; uFlicker: { value: number }; uPaper: { value: number[] } };
  keys: Key[];
  /** When it became ready (ms); the first world needs no dither-in. */
  arrived: number;
}

export async function initWorld(base: string, onReady?: () => void): Promise<void> {
  const host = document.querySelector<HTMLElement>(".world");
  if (!host) return;
  const root = document.documentElement;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = textureSize();
  const fetchWorld = (w: World) =>
    Promise.all(w.layers.map((l) => loadImage(`${base}/${l.file.replace("{size}", String(size))}`)));

  const renderer = new Renderer({ dpr, alpha: false, antialias: true, powerPreference: "high-performance" });
  const gl = renderer.gl;
  if (!gl) throw new Error("WebGL unavailable");
  const canvas = gl.canvas as HTMLCanvasElement;

  const camera = new Camera(gl, { fov: 30, near: 0.1, far: 100 });

  const shared = {
    uMoon: { value: 0.6 },
    uDpr: { value: dpr },
    uTime: { value: 0 },
    uBlue: { value: BLUE },
    uCream: { value: CREAM }
  };

  // framing (filled in by resize())
  let homeX = 0;
  let tanY = 0.27;
  let tanX = 0.43;

  function build(world: World, images: HTMLImageElement[], arrived: number): Built {
    const scene = new Transform();
    const u = { uReveal: { value: 0 }, uNight: { value: 0 }, uFlash: { value: 0 }, uFlicker: { value: 0 }, uPaper: { value: world.paper } };
    const H = PRINT_W / world.aspect;
    world.layers.forEach((layer, i) => {
      const scale = layerScale(layer.z);
      const uvScale = layer.sky ? 3 : 1; // the sky plane is 3× the print, paper beyond
      const geometry = new Plane(gl, {
        width: PRINT_W * scale * uvScale,
        height: H * scale * uvScale,
        widthSegments: layer.sky ? 1 : 24,
        heightSegments: layer.sky ? 1 : 16
      });
      const program = new Program(gl, {
        vertex,
        fragment,
        transparent: !layer.sky,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          ...shared,
          ...u,
          tMap: { value: new Texture(gl, { image: images[i], wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE }) },
          uSky: { value: layer.sky ? 1 : 0 },
          uUvScale: { value: uvScale },
          uSway: { value: layer.sway ?? 0 },
          uFlashGain: { value: layer.flash ?? 0 },
          uSparkle: { value: layer.sparkle ?? 0 },
          uFlickerGain: { value: layer.flicker ?? 0 }
        }
      });
      const mesh = new Mesh(gl, { geometry, program });
      mesh.position.z = layer.z;
      mesh.setParent(scene);
    });
    return { world, scene, u, keys: [], arrived };
  }

  // ---- loading: this theme's print now, the other on demand -----------------
  const worlds: { wave: Built | null; night: Built | null } = { wave: null, night: null };
  const loading: Partial<Record<"wave" | "night", Promise<void>>> = {};
  let firstDone = false;
  const ensure = (name: "wave" | "night") =>
    (loading[name] ??= fetchWorld(name === "wave" ? WAVE : NIGHT).then((images) => {
      worlds[name] = build(name === "wave" ? WAVE : NIGHT, images, firstDone ? performance.now() : -Infinity);
      firstDone = true;
      buildTracks();
    }));
  const current = () => (root.dataset.theme === "dark" ? "night" : "wave");
  const first = current();
  const second = first === "wave" ? "night" : "wave";
  await ensure(first);
  host.appendChild(canvas);
  // the other theme's print: when the theme is switched…
  new MutationObserver(() => ensure(current()).catch((e) => console.warn("[motion] second print unavailable", e))).observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });
  // …or quietly in the background on a fast connection
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!conn || (!conn.saveData && conn.effectiveType === "4g")) {
    const prefetch = () => setTimeout(() => ensure(second).catch(() => {}), 4000);
    if (document.readyState === "complete") prefetch();
    else window.addEventListener("load", prefetch, { once: true });
  }

  // ---- framing: the home shot covers the viewport, like object-fit: cover ----

  // Slide camera and target together so the view never shows past the
  // print's edges at any layer's depth.
  function keepInFrame(pos: number[], look: number[], edges: Edge[]) {
    let dx = 0;
    let dy = 0;
    for (const edge of edges) {
      const d = pos[2] - edge.z;
      if (d <= 0) continue;
      const t = d / (pos[2] - look[2]);
      const cx = pos[0] + (look[0] - pos[0]) * t + dx;
      const cy = pos[1] + (look[1] - pos[1]) * t + dy;
      const hw = tanX * d;
      const hh = tanY * d;
      if (edge.left !== undefined && cx - hw < edge.left) dx += edge.left - (cx - hw);
      if (edge.right !== undefined && cx + hw > edge.right) dx -= cx + hw - edge.right;
      if (edge.bottom !== undefined && cy - hh < edge.bottom) dy += edge.bottom - (cy - hh);
      if (edge.top !== undefined && cy + hh > edge.top) dy -= cy + hh - edge.top;
    }
    pos[0] += dx;
    look[0] += dx;
    pos[1] += dy;
    look[1] += dy;
  }

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    // CSS decides the canvas's size; never a stale pixel size
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const aspect = w / h;
    const printH = PRINT_W / WAVE.aspect;
    const visibleH = aspect > WAVE.aspect ? PRINT_W / aspect : printH;
    tanY = visibleH / 2 / HOME_Z;
    tanX = tanY * aspect;
    camera.perspective({ aspect, fov: (2 * Math.atan(tanY) * 180) / Math.PI });
    // narrow screens: keep the right of the print in frame (the wave's curl
    // and Fuji; the fireworks) rather than the dead centre
    const visibleW = visibleH * aspect;
    homeX = Math.min(1.2, Math.max(0, (PRINT_W - visibleW) / 2 - 0.2));
    buildTracks();
  };

  // ---- tracks: the camera's path, keyed to where the passages sit -----------
  // Home while the hero is on screen; in each passage, from its data-shot-from
  // as it enters the screen to its data-shot as it leaves.
  function buildTracks() {
    const vh = window.innerHeight;
    const top = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
    const built = [worlds.wave, worlds.night].filter((b): b is Built => !!b);
    for (const b of built) {
      const home = shotValue(b.world.shots.home);
      home[0] += homeX;
      home[3] += homeX;
      b.keys = [{ y: 0, value: home }];
    }
    document.querySelectorAll<HTMLElement>("[data-passage]").forEach((el) => {
      const start = top(el);
      const end = start + el.offsetHeight;
      for (const b of built) {
        const from = b.world.shots[el.dataset.shotFrom ?? ""];
        const to = b.world.shots[el.dataset.shot ?? ""];
        if (from) b.keys.push({ y: start - vh, value: shotValue(from) });
        if (to) b.keys.push({ y: end, value: shotValue(to) });
      }
    });
    for (const b of built) b.keys.sort((a, b2) => a.y - b2.y);
  }

  resize();
  window.addEventListener("resize", resize);
  // fonts, images and reveals change section heights after load
  new ResizeObserver(() => buildTracks()).observe(document.body);

  // ---- pointer: a little parallax ----
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  // ---- loop ----
  let dark = root.dataset.theme === "dark" ? 1 : 0;
  const start = performance.now();
  let nextBurst = 2 + Math.random() * 3; // seconds
  let burstAt = -10;
  let running = true;
  let drawn = false;

  // A lost context would leave a black screen: step aside for the flat print.
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    running = false;
    root.classList.remove("has-world");
    canvas.remove();
    console.warn("[motion] WebGL context lost: showing the flat print instead");
  });

  /** Dither-in for a print that arrives after the first (theme switch). */
  const arrival = (b: Built, now: number) => {
    const r = Math.min(1, (now - b.arrived) / 900);
    return 1 - Math.pow(1 - r, 3);
  };

  const frame = (now: number) => {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = (now - start) / 1000;
    const y = window.scrollY;

    // theme: 0 light … 1 dark, eased; a world that isn't loaded yet can't show
    const darkTarget = root.dataset.theme === "dark" ? 1 : 0;
    dark += (darkTarget - dark) * 0.06;
    if (Math.abs(darkTarget - dark) < 0.001) dark = darkTarget;
    const w = !worlds.night ? 0 : !worlds.wave ? 1 : dark; // night's share

    // camera: each world's track, blended while the theme changes
    const waveCam = worlds.wave ? sample(worlds.wave.keys, y) : null;
    const nightCam = worlds.night ? sample(worlds.night.keys, y) : null;
    const cam = (waveCam ?? nightCam)!.map((v, k) => (nightCam && waveCam ? v + (nightCam[k] - v) * w : v));
    const [px, py, pz, lx, ly, lz] = cam;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    const pos = [px + pointer.x * 0.25 + Math.sin(t * 0.2) * 0.05, py - pointer.y * 0.15, pz];
    const look = [lx, ly, lz];
    keepInFrame(pos, look, (w > 0.5 ? NIGHT : WAVE).edges);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt([look[0], look[1], look[2]]);

    const page = CREAM.map((c, k) => c + (DEEP[k] - c) * dark);
    gl.clearColor(page[0], page[1], page[2], 1);
    shared.uTime.value = t;
    shared.uMoon.value = 0.6 - 0.26 * dark; // dimmer moonlight in the dark theme

    // wave: underneath; moonlit when standing in for a night print not yet loaded
    let cleared = false;
    if (worlds.wave && w < 0.999) {
      const night = waveCam![6];
      worlds.wave.u.uNight.value = night + (Math.max(night, DARK_THEME_NIGHT) - night) * dark;
      worlds.wave.u.uReveal.value = arrival(worlds.wave, now);
      renderer.render({ scene: worlds.wave.scene, camera, sort: false });
      cleared = true;
    }

    // night: dithers in over the wave as the theme turns dark
    if (worlds.night && w > 0.001) {
      worlds.night.u.uReveal.value = Math.min(arrival(worlds.night, now), w);
      if (t > nextBurst) {
        burstAt = t;
        nextBurst = t + 4 + Math.random() * 6;
      }
      worlds.night.u.uFlash.value = burstCurve(t - burstAt) * 0.45;
      worlds.night.u.uFlicker.value = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 2.9 + 1.7) * 0.3 + Math.sin(t * 13.1) * 0.2;
      renderer.render({ scene: worlds.night.scene, camera, sort: false, clear: !cleared });
    }

    // the first real frame is on the canvas: now it can replace the flat print
    if (!drawn) {
      drawn = true;
      root.classList.add("has-world");
      onReady?.();
    }
  };
  requestAnimationFrame(frame);
}

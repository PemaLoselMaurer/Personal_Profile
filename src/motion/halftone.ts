// The portrait in About, drawn with OGL (WebGL) over HalftoneImage.astro.
//
//   halftone  cream dots on Prussian blue on a 45° grid; dot area follows
//             brightness. When it first scrolls into view the grid resolves
//             from coarse to fine.
//   lens      a soft circle under the cursor shows the clean photo.
//
// The pre-rendered fallback <img> stays underneath and the canvas is
// transparent until it has drawn, so a slow, failed or lost WebGL context
// always leaves the static halftone showing, never a black box.
import { Renderer, Program, Mesh, Triangle, Texture } from "ogl";
import gsap from "gsap";

/** Framing and tone of the portrait. Keep in sync with scripts/make-halftone.mjs. */
export const PORTRAIT = { zoom: 1.15, focus: [0.47, 0.55], gamma: 1.25, vignette: 0.35 };
/** Dots across the frame once resolved (the fallback PNG has ~137). */
const DOTS_ACROSS = 150;

const BLUE = [0x1b / 255, 0x2f / 255, 0x5c / 255];
const CREAM = [0xf4 / 255, 0xf1 / 255, 0xea / 255];

const vertex = /* glsl */ `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform vec2 uRes;          // drawing buffer, px
  uniform float uDpr;
  uniform sampler2D tPortrait;
  uniform vec4 uPortraitXf;   // image placement in buffer px: offset.xy, size.zw
  uniform float uCell;        // dot spacing, css px
  uniform float uIntro;       // 0..1, dots fade in
  uniform float uGamma;
  uniform float uVignette;
  uniform vec2 uMouse;        // buffer px, top-left origin
  uniform float uLens;        // 0..1
  uniform float uLensRadius;  // css px
  uniform vec3 uBlue;
  uniform vec3 uCream;

  vec4 sampleImage(sampler2D tex, vec4 xf, vec2 p) {
    vec2 uv = (p - xf.xy) / xf.zw;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(tex, vec2(uv.x, 1.0 - uv.y));
  }

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

    // --- halftone ---------------------------------------------------------
    const float C = 0.70710678;
    float cell = uCell * uDpr;
    vec2 r = vec2(C * p.x - C * p.y, C * p.x + C * p.y);       // into the 45° grid
    vec2 c = (floor(r / cell) + 0.5) * cell;                     // this dot's centre
    vec2 centre = vec2(C * c.x + C * c.y, -C * c.x + C * c.y);   // back to image space

    vec4 s = sampleImage(tPortrait, uPortraitXf, centre);
    float l = pow(smoothstep(0.06, 0.94, luma(s.rgb)), uGamma) * s.a;
    vec2 q = centre / uRes;
    float v = length(vec2(q.x - 0.5, (q.y - 0.5) * 0.9)) * 2.0;
    l *= 1.0 - uVignette * smoothstep(0.35, 1.05, v);

    float radius = cell * 0.55 * sqrt(l);
    float dotMask = clamp(radius - length(r - c) + 0.5, 0.0, 1.0);
    vec3 col = mix(uBlue, uCream, dotMask * uIntro);

    // --- lens: the clean photo under the cursor ---------------------------
    if (uLens > 0.001) {
      vec4 clean = sampleImage(tPortrait, uPortraitXf, p);
      vec3 photo = mix(uBlue, clean.rgb, clean.a);
      float R = uLensRadius * uDpr * mix(0.6, 1.0, uLens);
      float lens = (1.0 - smoothstep(R * 0.5, R, length(p - uMouse))) * uLens;
      col = mix(col, photo, lens);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img.decode().then(() => img);
}

/** Cover-fit an image into the frame, zoomed in and centred on `focus`. */
function placement(
  frameW: number,
  frameH: number,
  img: HTMLImageElement,
  zoom: number,
  focus: number[]
): [number, number, number, number] {
  const scale = Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) * zoom;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const clamp = (v: number, size: number, frame: number) => Math.min(0, Math.max(frame - size, v));
  return [clamp(frameW / 2 - focus[0] * w, w, frameW), clamp(frameH / 2 - focus[1] * h, h, frameH), w, h];
}

export async function initHalftone(): Promise<void> {
  const figure = document.querySelector<HTMLElement>("[data-halftone]");
  if (!figure?.dataset.src) return;

  // wait until the portrait is actually on screen, so its photo never
  // competes with the hero for bandwidth
  await new Promise<void>((resolve) => {
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      resolve();
    });
    io.observe(figure);
  });
  const portraitImg = await loadImage(figure.dataset.src);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({ dpr, alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
  const gl = renderer.gl;
  if (!gl) throw new Error("WebGL unavailable");

  const texture = (image: HTMLImageElement) =>
    new Texture(gl, {
      image,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE
    });
  const tPortrait = texture(portraitImg);

  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uRes: { value: [1, 1] },
      uDpr: { value: dpr },
      tPortrait: { value: tPortrait },
      uPortraitXf: { value: [0, 0, 1, 1] },
      uCell: { value: 34 },
      uIntro: { value: 0 },
      uGamma: { value: PORTRAIT.gamma },
      uVignette: { value: PORTRAIT.vignette },
      uMouse: { value: [0, 0] },
      uLens: { value: 0 },
      uLensRadius: { value: 130 },
      uBlue: { value: BLUE },
      uCream: { value: CREAM }
    }
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  const u = program.uniforms;

  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.opacity = "0";
  figure.appendChild(canvas);

  // a lost context (common with software renderers) would show as a black
  // box: remove the canvas and let the static halftone show
  let lost = false;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    canvas.remove();
    console.warn("[motion] portrait shader lost its WebGL context, showing the static halftone");
  });

  // ---- render on demand ---------------------------------------------------
  let dirty = true;
  let visible = true;
  const invalidate = () => {
    dirty = true;
  };
  gsap.ticker.add(() => {
    if (lost || !dirty || !visible) return;
    dirty = false;
    renderer.render({ scene: mesh });
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate();
  }).observe(figure);

  // ---- size -----------------------------------------------------------------
  const state = { cell: 34, fine: 7, settled: false };
  const resize = () => {
    const { width, height } = figure.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    // the frame decides the canvas size (OGL writes fixed pixels otherwise)
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    const W = width * dpr;
    const H = height * dpr;
    u.uRes.value = [W, H];
    u.uPortraitXf.value = placement(W, H, portraitImg, PORTRAIT.zoom, PORTRAIT.focus);
    u.uLensRadius.value = Math.max(90, width * 0.24);
    state.fine = Math.max(3, width / DOTS_ACROSS);
    if (state.settled) u.uCell.value = state.fine;
    invalidate();
  };
  resize();
  new ResizeObserver(resize).observe(figure);

  // ---- intro: dots resolve from coarse to fine -----------------------------
  gsap.to(canvas, { opacity: 1, duration: 0.5, ease: "power1.out" });
  gsap.fromTo(
    state,
    { cell: Math.max(22, state.fine * 6) },
    {
      cell: () => state.fine,
      duration: 1.9,
      ease: "expo.out",
      onUpdate: () => {
        u.uCell.value = state.cell;
        invalidate();
      },
      onComplete: () => {
        state.settled = true; // later resizes keep the fine grid
      }
    }
  );
  gsap.to(u.uIntro, { value: 1, duration: 0.6, ease: "power2.out", onUpdate: invalidate });

  // ---- lens -----------------------------------------------------------------
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const mouse = { x: 0, y: 0 };
    const toX = gsap.quickTo(mouse, "x", { duration: 0.6, ease: "expo.out", onUpdate: invalidate });
    const toY = gsap.quickTo(mouse, "y", { duration: 0.6, ease: "expo.out", onUpdate: invalidate });
    gsap.ticker.add(() => {
      u.uMouse.value = [mouse.x, mouse.y];
    });

    const local = (event: PointerEvent) => {
      const box = figure.getBoundingClientRect();
      return [(event.clientX - box.left) * dpr, (event.clientY - box.top) * dpr];
    };
    figure.addEventListener("pointerenter", (event) => {
      const [x, y] = local(event);
      gsap.set(mouse, { x, y });
      toX(x, x);
      toY(y, y);
      gsap.to(u.uLens, { value: 1, duration: 0.8, ease: "expo.out", overwrite: true, onUpdate: invalidate });
    });
    figure.addEventListener("pointermove", (event) => {
      const [x, y] = local(event);
      toX(x);
      toY(y);
    });
    figure.addEventListener("pointerleave", () => {
      gsap.to(u.uLens, { value: 0, duration: 1, ease: "expo.out", overwrite: true, onUpdate: invalidate });
    });
  }
}

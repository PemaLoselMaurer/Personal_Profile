// Motion entry point. Decides what runs, and logs which mode is active so it
// can be checked on the live site (look for "[motion]" in the console):
//
//   reduced-motion  the visitor asked for less motion: no animation, no 3D
//                   world. The flat print, static halftone and plain sections.
//   no-WebGL        animation runs, but the browser can't draw the 3D world
//                   or the portrait shader: flat print and static halftone.
//   timed-out       this code arrived after the 4s safety net in
//                   layouts/Base.astro had already shown the page. Entrance
//                   animations are skipped (the content is already visible);
//                   the 3D world, portrait shader and smooth scroll still start.
//   full            everything.
import { initEasterEgg } from "./easterEgg";
import { initStickyNav } from "./stickyNav";
import { initTheme } from "./theme";

declare global {
  interface Window {
    /** Set once entrance animations have taken over the hidden states in styles/motion.css. */
    __motionReady?: boolean;
  }
}

const root = document.documentElement;
const animated = root.classList.contains("motion");
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const since = () => `${Math.round(performance.now())} ms after navigation`;

initTheme();
initEasterEgg(animated);
initStickyNav();

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function whenIdle(task: () => void): void {
  if ("requestIdleCallback" in window) requestIdleCallback(task, { timeout: 1500 });
  else setTimeout(task, 300);
}

// If the reveal code fails, show the finished page instead.
function showEverything(error: unknown): void {
  console.error("[motion] animation failed, showing the static page", error);
  root.classList.add("motion-timeout");
}

async function start(webgl: boolean): Promise<void> {
  // the 3D world: the flat print stays until the world's first frame is drawn
  if (webgl) {
    import("./world")
      .then(({ initWorld }) => initWorld(base, () => console.info(`[motion] 3D world showing, ${since()}`)))
      .catch((error) => console.warn("[motion] 3D world unavailable, keeping the flat print", error));
  }

  // entrance animations, unless the safety net already showed the page
  if (!root.classList.contains("motion-timeout")) {
    try {
      const { initReveals } = await import("./reveal");
      if (!root.classList.contains("motion-timeout")) {
        initReveals();
        window.__motionReady = true;
      }
    } catch (error) {
      showEverything(error);
    }
  }

  if (webgl) {
    import("./halftone")
      .then(({ initHalftone }) => initHalftone())
      .catch((error) => console.warn("[motion] portrait shader unavailable, keeping the static halftone", error));
  }

  whenIdle(async () => {
    const [{ initSmoothScroll }, { initProjectHover }] = await Promise.all([
      import("./smoothScroll"),
      import("./projectHover")
    ]);
    initSmoothScroll();
    initProjectHover();
  });
}

if (!animated) {
  console.info("[motion] mode: reduced-motion (static page, no 3D world)");
} else {
  const webgl = hasWebGL();
  const mode = !webgl ? "no-WebGL" : root.classList.contains("motion-timeout") ? "timed-out" : "full";
  const detail = {
    "no-WebGL": "animations on, flat print and static halftone",
    "timed-out": "content was shown by the safety net; 3D world and effects still loading",
    full: "animations, 3D world and portrait shader"
  }[mode];
  console.info(`[motion] mode: ${mode} (${detail}), ${since()}`);
  start(webgl).catch(showEverything);
}

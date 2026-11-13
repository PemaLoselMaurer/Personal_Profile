// Motion entry point. Decides what loads and when:
//   - reduced motion: no animation and no 3D world. The flat print shows in
//     the hero, sections keep solid backgrounds, the easter egg still works.
//   - otherwise: hero reveals and the 3D world start at once; the portrait
//     shader waits until About is near; smooth scrolling and card hover load
//     when the browser is idle.
import { initEasterEgg } from "./easterEgg";
import { initStickyNav } from "./stickyNav";
import { initTheme } from "./theme";

declare global {
  interface Window {
    /** Set once animation code has taken over the hidden states in styles/motion.css. */
    __motionReady?: boolean;
  }
}

const root = document.documentElement;
const animated = root.classList.contains("motion");
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

initTheme();
initEasterEgg(animated);
initStickyNav();

function whenIdle(task: () => void): void {
  if ("requestIdleCallback" in window) requestIdleCallback(task, { timeout: 1500 });
  else setTimeout(task, 300);
}

// If animation code fails, show the finished page instead.
function giveUp(error: unknown): void {
  console.error("Animation unavailable, showing the static page.", error);
  root.classList.remove("motion");
}

// Without the world the page falls back to the flat print and solid sections.
function noWorld(error: unknown): void {
  console.warn("3D world unavailable, showing the flat print.", error);
  root.classList.add("world-failed");
}

async function start(): Promise<void> {
  // the world draws behind everything; start fetching it first
  import("./world").then(({ initWorld }) => initWorld(base)).catch(noWorld);
  setTimeout(() => {
    if (!root.classList.contains("has-world")) root.classList.add("world-failed");
  }, 8000);

  const { initReveals } = await import("./reveal");
  initReveals();
  window.__motionReady = true;

  // WebGL failing is fine: the static halftone is already on the page.
  import("./halftone")
    .then(({ initHalftone }) => initHalftone())
    .catch((error) => console.warn("Halftone effect unavailable, using the static image.", error));

  whenIdle(async () => {
    const [{ initSmoothScroll }, { initProjectHover }] = await Promise.all([
      import("./smoothScroll"),
      import("./projectHover")
    ]);
    initSmoothScroll();
    initProjectHover();
  });
}

if (animated) start().catch(giveUp);

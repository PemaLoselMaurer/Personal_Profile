// Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and the
// scroll position never disagree.
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function initSmoothScroll(): Lenis {
  // Anchor links stop below the fixed nav: Lenis reads the html element's
  // scroll-padding-top (set to --nav-h in base.css), so no offset here.
  const lenis = new Lenis({ lerp: 0.11, anchors: true });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

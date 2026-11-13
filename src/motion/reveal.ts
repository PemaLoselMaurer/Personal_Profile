// Restrained entrance motion, all expo.out:
//   [data-reveal="lines"]  headlines: each line slides up from behind a mask
//   [data-reveal="fade"]   body: fades in from 12px below
//   [data-reveal="image"]  images: clip-path opens while the image settles 1.08 → 1
// data-reveal-trigger="load" plays at once (the hero); everything else waits
// for the viewport.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = "expo.out";

function onLoad(el: Element): boolean {
  return (el as HTMLElement).dataset.revealTrigger === "load";
}

function revealLines(el: HTMLElement): void {
  const load = onLoad(el);
  gsap.set(el, { autoAlpha: 1 });
  SplitText.create(el, {
    type: "lines",
    mask: "lines",
    autoSplit: true, // re-splits on resize and font load
    onSplit: (self) =>
      gsap.from(self.lines, {
        yPercent: 110,
        duration: 1.15,
        ease: EASE,
        stagger: 0.1,
        delay: load ? 0.1 : 0,
        scrollTrigger: load ? undefined : { trigger: el, start: "top 88%", once: true }
      })
  });
}

function revealImage(el: HTMLElement): void {
  const inner = el.querySelector<HTMLElement>("[data-reveal-scale]") ?? el;
  gsap
    .timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } })
    .fromTo(
      el,
      { autoAlpha: 1, clipPath: "inset(12% 8% 12% 8%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: EASE, clearProps: "clipPath" }
    )
    .fromTo(inner, { scale: 1.08 }, { scale: 1, duration: 1.5, ease: EASE, clearProps: "scale" }, 0);
}

export function initReveals(): void {
  gsap.utils.toArray<HTMLElement>('[data-reveal="lines"]').forEach(revealLines);
  gsap.utils.toArray<HTMLElement>('[data-reveal="image"]').forEach(revealImage);

  const fades = gsap.utils.toArray<HTMLElement>('[data-reveal="fade"]');
  const from = { autoAlpha: 0, y: 12 };
  const to = { autoAlpha: 1, y: 0, duration: 1, ease: EASE, clearProps: "transform" };

  // Hero: right after the name
  gsap.fromTo(fades.filter(onLoad), from, { ...to, delay: 0.45, stagger: 0.09 });

  // Everything else: in small groups as it scrolls in
  const later = fades.filter((el) => !onLoad(el));
  gsap.set(later, from);
  ScrollTrigger.batch(later, {
    start: "top 92%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { ...to, stagger: 0.08 })
  });
}

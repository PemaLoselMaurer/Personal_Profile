// Project cards: a small "View" pill follows the cursor over cards that have
// a link (the image zoom itself is CSS). Fine pointers only.
import gsap from "gsap";

export function initProjectHover(): void {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const label = document.querySelector<HTMLElement>(".cursor-label");
  const cards = gsap.utils.toArray<HTMLElement>(".card--linked");
  if (!label || !cards.length) return;

  document.documentElement.classList.add("has-cursor-label");
  gsap.set(label, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });
  const toX = gsap.quickTo(label, "x", { duration: 0.5, ease: "expo.out" });
  const toY = gsap.quickTo(label, "y", { duration: 0.5, ease: "expo.out" });

  cards.forEach((card) => {
    card.addEventListener("pointerenter", (event) => {
      gsap.set(label, { x: event.clientX, y: event.clientY });
      label.textContent = card.dataset.hoverLabel ?? label.textContent;
      gsap.to(label, { scale: 1, autoAlpha: 1, duration: 0.5, ease: "expo.out", overwrite: "auto" });
    });
    card.addEventListener("pointermove", (event) => {
      toX(event.clientX);
      toY(event.clientY);
    });
    card.addEventListener("pointerleave", () => {
      gsap.to(label, { scale: 0, autoAlpha: 0, duration: 0.4, ease: "expo.out", overwrite: "auto" });
    });
  });
}

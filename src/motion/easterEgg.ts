// The key in the footer: click it and the cipher line scrambles into plain
// text (GSAP ScrambleText). Click again to lock it. Loaded on first click
// only. With reduced motion the line simply changes.

export function initEasterEgg(animated: boolean): void {
  const key = document.getElementById("egg-key");
  const cipher = document.getElementById("cipher");
  const ink = cipher?.querySelector<HTMLElement>(".cipher__ink");
  const spoken = cipher?.querySelector<HTMLElement>(".sr-only");
  const plain = cipher?.dataset.plain;
  if (!key || !cipher || !ink || !spoken || !plain) return;

  const locked = ink.textContent ?? "";

  key.addEventListener("click", async () => {
    const open = key.getAttribute("aria-pressed") !== "true";
    const target = open ? plain : locked;
    key.setAttribute("aria-pressed", String(open));
    cipher.classList.toggle("is-open", open);
    spoken.textContent = open ? plain : "";

    if (!animated) {
      ink.textContent = target;
      return;
    }
    const [{ default: gsap }, { ScrambleTextPlugin }] = await Promise.all([
      import("gsap"),
      import("gsap/ScrambleTextPlugin")
    ]);
    gsap.registerPlugin(ScrambleTextPlugin);
    gsap.to(ink, {
      duration: 1.4,
      ease: "none",
      overwrite: true,
      scrambleText: { text: target, chars: "lowerCase", revealDelay: 0.25, speed: 0.5 }
    });
  });
}

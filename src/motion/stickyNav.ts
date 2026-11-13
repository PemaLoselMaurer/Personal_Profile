// Keeps the fixed nav in step with the page:
//   - blue palette over night-toned sections, cream over day-toned ones
//   - a background and rule once the page is scrolled
//   - aria-current on the link of the section being read
// Not an animation (colour changes are CSS transitions), so it also runs for
// reduced-motion visitors.

export function initStickyNav(): void {
  const nav = document.querySelector<HTMLElement>(".sitenav");
  if (!nav) return;

  const blueAreas = Array.from(document.querySelectorAll<HTMLElement>("[data-tone=\"night\"]"));
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.nav a[href^="#"]'));
  const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
  let frame = 0;

  const update = () => {
    frame = 0;
    const height = nav.offsetHeight;
    const line = height; // match the content starting right under the bar

    const underBlue = blueAreas.some((el) => {
      const box = el.getBoundingClientRect();
      return box.top <= line && box.bottom > line + 1; // 1px for sub-pixel layout
    });
    nav.classList.toggle("on-blue", underBlue);
    nav.classList.toggle("is-scrolled", window.scrollY > 4);

    // current section: the last one whose top has reached the bar,
    // or the last one outright at the very bottom of the page
    let current = -1;
    targets.forEach((target, i) => {
      if (target && target.getBoundingClientRect().top <= height + 1) current = i;
    });
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom) current = targets.length - 1;
    links.forEach((a, i) => {
      if (i === current) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}

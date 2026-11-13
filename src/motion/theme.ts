// Light / dark theme toggle (the button in the nav).
// The starting theme is set before first paint by an inline script in
// layouts/Base.astro. A click saves the choice; until then the page follows
// the system setting, live. Not an animation, so it runs with reduced motion
// too. The 3D world reads data-theme every frame and eases across.

type Theme = "light" | "dark";

const root = document.documentElement;
const system = window.matchMedia("(prefers-color-scheme: dark)");

function saved(): Theme | null {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme, button: HTMLElement | null): void {
  root.dataset.theme = theme;
  if (!button) return;
  const dark = theme === "dark";
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", "Dark theme");
}

export function initTheme(): void {
  const button = document.getElementById("theme-toggle");
  apply((root.dataset.theme as Theme) ?? "light", button);

  button?.addEventListener("click", () => {
    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";
    apply(next, button);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
  });

  system.addEventListener("change", (event) => {
    if (!saved()) apply(event.matches ? "dark" : "light", button);
  });
}

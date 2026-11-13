// @ts-check
import { defineConfig } from "astro/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Adds <link rel="modulepreload"> for the animation code to the built pages.
 * The entry script loads these with dynamic import() only after it has run;
 * preloading starts the downloads with the HTML instead, which matters on
 * slow connections. Chunk names are hashed, so they are matched here by
 * their stem after the build.
 * @returns {import("astro").AstroIntegration}
 */
function preloadMotion() {
  // the chunks needed for the first screen: entrance animations, the 3D world
  const stems = ["reveal", "gsap", "ScrollTrigger", "world", "Texture"];
  return {
    name: "preload-motion",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const out = fileURLToPath(dir);
        const files = await readdir(path.join(out, "_astro"));
        const chunks = files.filter((f) => f.endsWith(".js") && stems.includes(f.split(".")[0]));
        for (const page of (await readdir(out)).filter((f) => f.endsWith(".html"))) {
          const file = path.join(out, page);
          const html = await readFile(file, "utf8");
          const entry = html.match(/<script type="module" src="([^"]+)"/)?.[1];
          if (!entry) continue;
          const assets = entry.slice(0, entry.lastIndexOf("/") + 1);
          const links = [entry, ...chunks.map((c) => assets + c)].map((href) => `<link rel="modulepreload" href="${href}">`).join("");
          await writeFile(file, html.replace("</head>", `${links}</head>`));
        }
      }
    }
  };
}

// GitHub Pages project site: https://pemaloselmaurer.github.io/Personal_Profile/
// If the repo is renamed, or a custom domain is added, change `site` and `base`.
export default defineConfig({
  site: "https://pemaloselmaurer.github.io",
  base: "/Personal_Profile",
  output: "static",
  integrations: [preloadMotion()]
});

// @ts-check
import { defineConfig } from "astro/config";

// GitHub Pages project site: https://pemaloselmaurer.github.io/Personal_Profile/
// If the repo is renamed, or a custom domain is added, change `site` and `base`.
export default defineConfig({
  site: "https://pemaloselmaurer.github.io",
  base: "/Personal_Profile",
  output: "static"
});

// Resolves a file in public/ against the configured `base`, so links work
// both locally and under https://<user>.github.io/<repo>/.
export function asset(path: string): string {
  if (/^([a-z]+:|#)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return encodeURI(`${base}/${path.replace(/^\.?\//, "")}`);
}

export function isExternal(href: string): boolean {
  return /^https?:/i.test(href);
}

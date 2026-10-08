/** Resolve local assets under either a domain root or a GitHub Pages project path. */
export function publicAssetUrl(url: string, basePath = process.env.NEXT_PUBLIC_ASSET_BASE || "/"): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  const base = `/${basePath.split("/").filter(Boolean).join("/")}`;
  if (base === "/" || url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

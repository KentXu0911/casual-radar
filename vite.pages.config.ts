import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const base = `/${(process.env.PAGES_BASE_PATH || "casual-radar").split("/").filter(Boolean).join("/")}/`.replace(/^\/\/$/, "/");
const siteUrl = process.env.PAGES_SITE_URL || `https://kentxu0911.github.io${base}`;

export default defineConfig({
  root: path.join(projectRoot, "static"),
  publicDir: path.join(projectRoot, "public"),
  base,
  plugins: [react(), {
    name: "dashboard-site-metadata",
    transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl),
  }],
  define: {
    "process.env.NEXT_PUBLIC_ASSET_BASE": JSON.stringify(base),
  },
  build: {
    outDir: path.join(projectRoot, "out"),
    emptyOutDir: true,
  },
});

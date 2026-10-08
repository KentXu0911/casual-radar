import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "out");
const base = `/${(process.env.PAGES_BASE_PATH || "casual-radar").split("/").filter(Boolean).join("/")}/`.replace(/^\/\/$/, "/");

test("Pages HTML loads its JavaScript, stylesheet and icon under the project path", async () => {
  const html = await readFile(path.join(output, "index.html"), "utf8");
  assert.match(html, /Casual Radar｜休闲互动游戏产品看板/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /%[A-Z_]+%/);
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.some((url) => url.endsWith(".js")));
  assert.ok(assets.some((url) => url.endsWith(".css")));
  for (const url of assets) {
    assert.ok(url.startsWith(base), `Asset escapes Pages base: ${url}`);
    await access(path.join(output, url.slice(base.length)));
  }
});

test("Pages ships all dashboard data, current candidates and verified test footage", async () => {
  const names = ["dashboard_data", "games", "pipeline-icons", "databrain_trends", "databrain_trends_90d", "databrain_latest_metrics", "databrain_snapshots", "video-covers", "pc-metrics", "development-profiles", "pc-trends", "databrain_events", "databrain_research", "youyansuo_discovery"];
  for (const name of names) JSON.parse(await readFile(path.join(output, `${name}.json`), "utf8"));
  const discovery = JSON.parse(await readFile(path.join(output, "youyansuo_discovery.json"), "utf8"));
  assert.equal(discovery.candidates.length, 2);
  const covers = JSON.parse(await readFile(path.join(output, "video-covers.json"), "utf8"));
  for (const key of ["BV1Rmh96ZERt", "BV1k6Nb6KEC2", "BV1qkhJ6PESD", "BV1rTH16DESw", "BV18Keu6fEGX", "BV1Mohb61Em9"]) {
    const entry = covers[key] || covers[`https://www.bilibili.com/video/${key}/`];
    assert.ok(entry?.path, `Missing verified cover: ${key}`);
    await access(path.join(output, entry.path.replace(/^\//, "")));
  }
});

test("static deployment does not contain local credentials or server bindings", async () => {
  const entries = await readdir(output);
  for (const forbidden of [".env", ".env.local", ".openai", "server", "worker", ".git", ".automation"]) {
    assert.ok(!entries.includes(forbidden), `Private runtime file was exported: ${forbidden}`);
  }
  await access(path.join(output, ".nojekyll"));
});

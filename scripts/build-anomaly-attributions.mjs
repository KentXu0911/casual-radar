import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnomalyAttributionBundle } from "./anomaly-attribution-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(siteRoot, "public");
const read = (name) => JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8"));

const trends = read("databrain_trends_90d.json");
const games = read("games.json");
const events = read("databrain_events.json");
const asOf = trends.meta?.query_range?.at(-1) || new Date().toISOString().slice(0, 10);
const bundle = buildAnomalyAttributionBundle({
  trends: trends.games,
  games: games.games,
  events: events.games,
  eventMeta: events.meta,
  asOf,
  reviewedAt: new Date().toISOString().slice(0, 10),
});

const outputPath = path.join(publicRoot, "anomaly-attributions.json");
fs.writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ output: outputPath, ...bundle.meta })}\n`);

if (bundle.meta.uncovered_alerts > 0) {
  throw new Error(`仍有 ${bundle.meta.uncovered_alerts} 个异动缺少可追溯归因核查记录。`);
}

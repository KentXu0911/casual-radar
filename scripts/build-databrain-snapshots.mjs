import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = path.resolve(projectDir, "../outputs/休闲互动类游戏_看板_v6.html");
const outputPath = path.join(projectDir, "public", "databrain_snapshots.json");

const html = fs.readFileSync(sourcePath, "utf8");
const match = html.match(/const G = (\[.*?\]);\s*const /s);
if (!match) throw new Error("Could not find the DataBrain game bundle in the previous dashboard export");

const games = JSON.parse(match[1]);
const snapshots = Object.fromEntries(
  games
    .filter((game) => game.metrics || game.data_coverage || game.databrain_url)
    .map((game) => [
      game.name,
      {
        ...(game.metrics ? { metrics: game.metrics } : {}),
        ...(game.data_coverage ? { data_coverage: game.data_coverage } : {}),
        ...(game.databrain_url ? { databrain_url: game.databrain_url } : {}),
      },
    ]),
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    {
      meta: {
        source: "outputs/休闲互动类游戏_看板_v6.html",
        games_with_metrics: Object.values(snapshots).filter((game) => game.metrics).length,
        generated_at: new Date().toISOString(),
      },
      games: snapshots,
    },
    null,
    2,
  ) + "\n",
);

console.log(`wrote ${Object.keys(snapshots).length} DataBrain snapshots to ${outputPath}`);

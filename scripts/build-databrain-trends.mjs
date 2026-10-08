import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const sourcePath = fileURLToPath(new URL("../../outputs/databrain_trends_normalized.json", import.meta.url));
const targetPath = fileURLToPath(new URL("../public/databrain_trends.json", import.meta.url));
const source = JSON.parse(await readFile(sourcePath, "utf8"));

const payload = {
  meta: source.meta,
  games: source.games,
};

await writeFile(targetPath, `${JSON.stringify(payload)}\n`);
console.log(`wrote ${Object.keys(payload.games || {}).length} DataBrain trend series to ${targetPath}`);

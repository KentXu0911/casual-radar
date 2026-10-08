import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { synchronizeDiscoveredStudioProducts } from "./studio-association-lib.mjs";

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const read = (file) => JSON.parse(fs.readFileSync(path.join(publicRoot, file), "utf8"));
const dashboard = read("dashboard_data.json");
const games = read("games.json");
const updates = synchronizeDiscoveredStudioProducts(dashboard, games);
if (updates.length) {
  for (const [file, value] of [["dashboard_data.json", dashboard], ["games.json", games]]) {
    fs.writeFileSync(path.join(publicRoot, file), `${JSON.stringify(value, null, 2)}\n`);
  }
}
console.log(JSON.stringify({ studio_associations: updates }));

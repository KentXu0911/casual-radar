import fs from "node:fs";
import { synchronizeRevealMedia } from "./pipeline-reveal-media-lib.mjs";

const file = name => new URL(`../public/${name}.json`, import.meta.url);
const read = name => JSON.parse(fs.readFileSync(file(name), "utf8"));
const dashboard = read("dashboard_data");
const games = read("games");
synchronizeRevealMedia(dashboard, games, read("pipeline-reveal-media"));
for (const [name, data] of [["dashboard_data", dashboard], ["games", games]]) {
  fs.writeFileSync(file(name), `${JSON.stringify(data, null, 2)}\n`);
}
console.log("Restored verified reveal PVs and development footage to their timeline nodes.");

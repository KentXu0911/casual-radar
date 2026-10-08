import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncGrpReports } from "./grp-report-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const read = (name) => JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8"));
const games = read("games.json");
const dashboard = read("dashboard_data.json");
const reports = read("grp_reports.json");
const attached = syncGrpReports(games, dashboard, reports);

fs.writeFileSync(path.join(publicRoot, "dashboard_data.json"), `${JSON.stringify(dashboard, null, 2)}\n`);
fs.writeFileSync(path.join(publicRoot, "games.json"), `${JSON.stringify(games, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ reports: reports.reports.length, attached }, null, 2)}\n`);

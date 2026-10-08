import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { matchGrpReports, syncGrpReports } from "../scripts/grp-report-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, "public", name), "utf8"));

test("matches GRP reports through Chinese names and historical codenames", () => {
  const games = read("games.json").games.filter((game) => ["Aniimo", "妖妖棋"].includes(game.name));
  const reports = read("grp_reports.json").reports;
  const matches = matchGrpReports(games, reports);
  assert.deepEqual(matches.get("Aniimo").map((report) => report.id), [64, 63, 153]);
  assert.deepEqual(matches.get("妖妖棋").map((report) => report.id), [74]);
  assert.equal(matchGrpReports([{ name: "炉石传说：酒馆战棋" }], reports).has("炉石传说：酒馆战棋"), false);
});

test("turns explicit GRP test rounds into clearly dated timeline evidence", () => {
  const games = read("games.json");
  const dashboard = read("dashboard_data.json");
  const reports = read("grp_reports.json");
  const attached = syncGrpReports(games, dashboard, reports);
  assert.equal(attached.length, 4);
  assert.deepEqual(
    dashboard.pipelineDetails.Aniimo.media_reports
      .filter((report) => report.source === "GRP")
      .map((report) => [report.timeline_title, report.lifecycle_phase, report.timeline_date_basis]),
    [["三测产品分析", "retest", "report_date"], ["二测产品分析", "retest", "report_date"], ["首测产品分析", "first", "report_date"]]
  );
  assert.equal(dashboard.pipelineDetails["妖妖棋"].media_reports.find((report) => report.report_id === 74)?.source, "GRP");
  assert.ok([64, 63, 74, 153].every((id) => dashboard.pipelineMeta.grp_reports.includes(id)));
});

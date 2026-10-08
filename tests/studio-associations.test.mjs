import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { synchronizeDiscoveredStudioProducts } from "../scripts/studio-association-lib.mjs";

function fixture() {
  return {
    dashboard: {
      domesticStudios: [{ name: "莉莉丝", company_aliases: ["莉莉丝游戏"], known_pipeline: [] }],
      pipelineGroups: [{ name: "游研所新增在研新品", projects: ["新项目"] }],
      pipelineDetails: { 新项目: { team: { studio: "猫爪拿铁工作室", company: "莉莉丝游戏", sources: [{ url: "https://www.taptap.cn/app/904033" }] } } },
    },
    games: { games: [{ name: "新项目", lifecycle: { pipeline: true } }], meta: { studio_tracking: { domestic_majors: { studios: [{ name: "莉莉丝", known_pipeline: [] }] } } } },
  };
}

test("admitted, sourced company affiliations update both studio lists and remove the discovery duplicate", () => {
  const { dashboard, games } = fixture();
  assert.deepEqual(synchronizeDiscoveredStudioProducts(dashboard, games), [{ product: "新项目", studio: "莉莉丝" }]);
  assert.deepEqual(dashboard.domesticStudios[0].known_pipeline, ["新项目"]);
  assert.deepEqual(dashboard.pipelineGroups.find((group) => group.name === "莉莉丝").projects, ["新项目"]);
  assert.deepEqual(dashboard.pipelineGroups[0].projects, []);
  assert.deepEqual(games.meta.studio_tracking.domestic_majors.studios[0].known_pipeline, ["新项目"]);
  assert.deepEqual(synchronizeDiscoveredStudioProducts(dashboard, games), []);
  assert.deepEqual(dashboard.domesticStudios[0].known_pipeline, ["新项目"]);
});

test("unknown, unsourced, ambiguous and unadmitted projects never acquire a guessed studio", () => {
  for (const mutate of [
    ({ dashboard }) => { dashboard.pipelineDetails.新项目.team.company = "未公开"; },
    ({ dashboard }) => { dashboard.pipelineDetails.新项目.team.sources = []; },
    ({ dashboard }) => { dashboard.domesticStudios.push({ name: "另一厂商", company_aliases: ["莉莉丝游戏"] }); },
    ({ games }) => { games.games[0].lifecycle.pipeline = false; },
    ({ games }) => { games.games = []; },
    ({ games }) => { games.games[0].pool = "边界观察池"; },
    ({ dashboard, games }) => { delete dashboard.pipelineDetails.新项目.team.company; games.games[0].publisher = "莉莉丝游戏"; },
  ]) {
    const data = fixture();
    mutate(data);
    assert.deepEqual(synchronizeDiscoveredStudioProducts(data.dashboard, data.games), []);
    assert.deepEqual(data.dashboard.pipelineGroups[0].projects, ["新项目"]);
    assert.deepEqual(data.dashboard.domesticStudios[0].known_pipeline, []);
  }
});

test("Lilith's animal city is linked to its real company with its sourced team intact", () => {
  const dashboard = JSON.parse(fs.readFileSync(new URL("../public/dashboard_data.json", import.meta.url), "utf8"));
  const studio = dashboard.domesticStudios.find((entry) => entry.name === "莉莉丝");
  assert.equal(studio.known_pipeline.filter((entry) => entry === "奇遇动物城").length, 1);
  assert.ok(dashboard.pipelineGroups.find((group) => group.name === "莉莉丝").projects.includes("奇遇动物城"));
  assert.ok(!dashboard.pipelineGroups.find((group) => group.name === "游研所新增在研新品").projects.includes("奇遇动物城"));
  const detail = dashboard.pipelineDetails.奇遇动物城;
  assert.equal(detail.team.studio, "猫爪拿铁工作室");
  assert.equal(detail.team.company, "莉莉丝游戏");
  assert.equal(detail.team.keyMembers[0].name, "林克");
  assert.equal(detail.stage_date, "2026-09-24");
});

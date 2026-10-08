import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`, import.meta.url), "utf8"));
const games = read("games").games;
const dashboard = read("dashboard_data");
const intake = read("game-intake");
const profiles = read("development-profiles");

test("youyansuo discoveries are sourced observations, not in-development projects", () => {
  for (const [name, category, storeId] of [
    ["闪耀吧！噜咪", "捉宠类", "6754912970"],
    ["BanG Dream! Our Notes", "社交-多人合作类", "6757695187"],
  ]) {
    for (const collection of [games, dashboard.games]) {
      const matches = collection.filter((game) => game.name === name);
      assert.equal(matches.length, 1, `${name} should have one canonical entry`);
      const game = matches[0];
      assert.equal(game.category, category);
      assert.equal(game.pool, "边界观察池");
      assert.equal(game.track, "新品发现");
      assert.equal(game.lifecycle.pipeline, false);
      assert.match(game.profile.source_url.find((source) => source.type === "官方商店")?.url || "", new RegExp(storeId));
      assert.ok(game.intelligence.recent_articles.some((article) => article.url.includes("mp.weixin.qq.com")));
      assert.ok(fs.existsSync(new URL(`../public${game.icon_path}`, import.meta.url)));
    }
    assert.equal(intake[name]?.added_on, "2026-09-28");
    assert.equal(profiles[name]?.coverage_level, "基础归属");
    assert.equal(dashboard.pipelineDetails[name], undefined);
    assert.ok(dashboard.pipelineGroups.every((group) => !group.projects.includes(name)));
  }
  assert.equal(games.find((game) => game.name === "BanG Dream! Our Notes")?.identity_status, "matched_by_store_id");
});

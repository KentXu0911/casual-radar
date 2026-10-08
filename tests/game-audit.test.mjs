import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8"));
const games = read("games.json");
const dashboard = read("dashboard_data.json");
const trends = read("databrain_trends_90d.json");
const metrics = read("databrain_latest_metrics.json");
const events = read("databrain_events.json");
const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

const released = [
  "多多自走棋", "Mechabellum", "The Bazaar", "Once Upon a Galaxy", "Random Dice 2", "PICO PARK 2",
  "人类一败涂地", "Chained Together", "Deceit 2", "The Outlast Trials", "mo.co",
];
const pipeline = ["Aniimo", "My Time at Evershine"];

test("adds the audited products once with verified lifecycle placement", () => {
  assert.equal(games.meta.updated, "2026-09-20");
  assert.deepEqual(games.meta.audit.added, [...released, ...pipeline]);
  for (const name of [...released, ...pipeline]) {
    assert.equal(games.games.filter((game) => game.name === name).length, 1, `${name} should be unique`);
    assert.match(games.games.find((game) => game.name === name).profile.source_url[0].url, /^https:\/\//);
  }
  assert.ok(released.every((name) => games.games.find((game) => game.name === name).lifecycle.pipeline === false));
  assert.equal(games.games.find((game) => game.name === "My Time at Evershine").lifecycle.pipeline, true);
  assert.equal(games.games.find((game) => game.name === "Aniimo").lifecycle.pipeline, false);
  assert.match(games.games.find((game) => game.name === "Aniimo").release_status, /已上线.*PC\/主机\/iOS\/Android/);
  assert.ok(games.games.find((game) => game.name === "Aniimo").aliases.includes("伊莫"));
  assert.ok(dashboard.pipelineGroups.every((group) => !group.projects.includes("Aniimo")));
  assert.match(page, /Aniimo:[\s\S]*?Pawprint Studio（杭州爪印工作室）[\s\S]*?FunPlus（趣加）[\s\S]*?上海趣乐糖[\s\S]*?location: "杭州"[\s\S]*?研发已超过一年/);
  assert.equal(dashboard.pipelineDetails.Aniimo.media_reports.some((report) => /补检|补回|内部资料/.test(`${report.kind} ${report.title} ${report.summary}`)), false);
  assert.doesNotMatch(dashboard.pipelineDetails.Aniimo.assessment.verdict.summary, /别名补检|补回|接入/);
  assert.equal(dashboard.pipelineDetails.Aniimo.assessment.source.title, "《伊莫》三测产品分析");
  assert.equal(dashboard.pipelineDetails.Aniimo.assessment.source.label, "GRP 报告 #153");
  assert.match(dashboard.pipelineDetails.Aniimo.testing.records[0].title, /PC 与主机端正式上线/);
  assert.equal(dashboard.pipelineDetails.Aniimo.testing.records[0].lifecycle_phase, "launch");
  assert.match(dashboard.pipelineDetails.Aniimo.testing.records[1].title, /iOS \/ Android正式上线/);
  assert.equal(dashboard.pipelineDetails.Aniimo.testing.records[1].status, "confirmed");
  assert.equal(dashboard.pipelineDetails.Aniimo.testing.records[1].url, "https://www.aniimo.com/newslist/detail/100147");
  assert.deepEqual(dashboard.pipelineDetails.Aniimo.media_reports.map((report) => report.report_id).filter(Boolean).sort((a, b) => a - b), [63, 64, 153]);
  assert.ok(dashboard.pipelineDetails.Aniimo.gameplay_videos.length >= 2);
  assert.ok(dashboard.pipelineDetails.Aniimo.gameplay_videos.some((video) => video.source === "Aniimo 官方" && /Gameplay Showcase/.test(video.title)));
  assert.ok(dashboard.pipelineDetails.Aniimo.gameplay_videos.some((video) => /5:44:50/.test(video.type)));
  assert.ok(dashboard.pipelineDetails.Aniimo.media_reports.length >= 6);
  assert.ok(["IT之家", "4Gamers", "凤凰网科技"].every((source) => dashboard.pipelineDetails.Aniimo.media_reports.some((report) => report.source === source)));
  assert.ok(dashboard.pipelineDetails.Aniimo.assessment.strengths.length >= 4);
  assert.ok(dashboard.pipelineDetails.Aniimo.assessment.risks.length >= 4);
  assert.ok(dashboard.pipelineDetails.Aniimo.assessment.changes_since_last_test.length >= 4);
  assert.ok(dashboard.pipelineDetails.Aniimo.assessment.next_watch.length >= 4);
  assert.match(page, /items\.slice\(0, 5\)/);
  assert.match(page, /entry\.timeline === true/);
  assert.match(page, /"My Time at Evershine": \{[\s\S]*?Pathea Games《My Time at Evershine》项目组[\s\S]*?location: "重庆"[\s\S]*?吴子飞（Zifei Wu）[\s\S]*?波西亚时光[\s\S]*?沙石镇时光[\s\S]*?\$2,901,842[\s\S]*?不等同研发成本/);
  assert.match(page, /knownGame\?\.lifecycle\?\.pipeline === true[\s\S]*?\? "在研新品"/);
  assert.equal(dashboard.pipelineGroups.find((group) => group.name === "其他厂商在研新品").projects.includes("My Time at Evershine"), false);
  assert.deepEqual(dashboard.pipelineGroups.find((group) => group.name === "Pathea Games").projects, ["My Time at Evershine"]);
  assert.match(dashboard.domesticStudios.find((studio) => studio.name === "Pathea Games").track_focus, /My Time 系列续作/);
  assert.equal(dashboard.pipelineDetails["My Time at Evershine"].updated_at, "2026-09-20");
  assert.match(page, /item\.updated_at \|\| item\.stage_date/);
  assert.equal(games.games.find((game) => game.name === "妖妖棋").profile.license_isbn, "978-7-498-16357-8");
});

test("keeps audited DataBrain coverage platform-specific and leaves real gaps empty", () => {
  for (const name of ["多多自走棋", "Mechabellum", "The Bazaar", "Once Upon a Galaxy", "PICO PARK 2", "Deceit 2", "The Outlast Trials"]) {
    assert.ok(metrics.pc_games[name], `${name} should have a PC snapshot`);
    assert.ok(trends.games[name].activity.points.length >= 89, `${name} should have a near-90-day activity series`);
  }
  assert.ok(metrics.mobile_games["人类一败涂地"]);
  assert.ok(metrics.pc_games["人类一败涂地"]);
  assert.ok(metrics.mobile_games["多多自走棋"]);
  assert.ok(metrics.pc_games["多多自走棋"]);
  assert.equal(trends.games["多多自走棋"].activity.label, "DAU");
  assert.ok(trends.games["多多自走棋"].activity.points.length >= 89);
  assert.ok(trends.games["多多自走棋"].revenue.points.length >= 89);
  assert.ok(metrics.mobile_games["mo.co"]);
  assert.equal(metrics.mobile_games["Random Dice 2"], undefined);
  assert.equal(metrics.pc_games["Random Dice 2"], undefined);
  assert.equal(trends.games["Chained Together"], undefined);
  assert.equal(trends.games["My Time at Evershine"], undefined);
  assert.ok(metrics.pc_games.Aniimo);
  if (metrics.mobile_games.Aniimo) {
    assert.equal(metrics.mobile_games.Aniimo.platform, "mobile");
    assert.ok(Number.isFinite(metrics.mobile_games.Aniimo.dau));
    assert.match(metrics.mobile_games.Aniimo.source_url, /^https:\/\//);
    assert.equal(trends.games.Aniimo.activity.label, "DAU");
  } else {
    assert.equal(trends.games.Aniimo.activity.label, "PC 日均 ACU");
  }
  const pcTrend = read("pc-trends.json").games.Aniimo;
  assert.equal(pcTrend.activity.label, "PC 日均 ACU");
  assert.ok(pcTrend.activity.points.length >= 4);
  assert.match(games.games.find((game) => game.name === "Aniimo").data_coverage.metrics_status, /PC 日频序列/);
  assert.ok(events.games.Aniimo.some((event) => /Aniimo|伊莫/i.test(`${event.title} ${event.summary}`) && /^https:\/\//.test(event.url)));
  assert.equal(events.games["妖妖棋"].some((event) => /91手游网|交易猫|\/apk\//i.test(`${event.source} ${event.url}`)), false);
});

test("does not count alias records as separate headline products", async () => {
  const profileBuilder = fs.readFileSync(new URL("../scripts/build-development-profiles.mjs", import.meta.url), "utf8");
  assert.match(page, /if \(game\.alias_of\) return false/);
  assert.match(profileBuilder, /if \(game\.alias_of\) return false/);
  assert.equal(games.games.find((game) => game.name === "代号：奇旅").alias_of, "山海奇旅");
});

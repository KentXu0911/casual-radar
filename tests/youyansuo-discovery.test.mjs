import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeDiscovery } from "../scripts/normalize-youyansuo-discovery.mjs";
import { assertCleanWorktree } from "../scripts/refresh-runner-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const row = (name, extra = {}) => ({
  name,
  published_date: "2026-09-28",
  evidence_title: `${name}报道`,
  source_url: `https://example.com/${encodeURIComponent(name)}`,
  summary: "文章提到产品开发进展。",
  ...extra,
});
const input = (extra = {}) => ({
  scan_date: "2026-09-28",
  source: "youyansuo",
  mode: "mcp_read_only",
  status: "complete",
  tool_calls: { total: 2, search_articles: { calls: 1 }, search_games: { calls: 1 } },
  candidates: [],
  tracked_updates: [],
  ...extra,
});
const games = { games: [
  { name: "Aniimo", aliases: ["伊莫", "共享代号"] },
  { name: "另一个游戏", aliases: ["共享代号"] },
] };

test("rejects stale, partial and unevidenced MCP scans", () => {
  assert.throws(() => normalizeDiscovery(input({ status: "partial" }), games, { today: "2026-09-28" }), /未完整成功/);
  assert.throws(() => normalizeDiscovery(input({ scan_date: "2026-09-27" }), games, { today: "2026-09-28" }), /不是今天/);
  assert.throws(() => normalizeDiscovery(input({ tool_calls: { total: 0 } }), games, { today: "2026-09-28" }), /工具调用记录/);
  assert.throws(() => normalizeDiscovery(input({ scan_date: "2026-02-31" }), games, { today: "2026-02-31" }), /不是今天/);
});

test("keeps candidates separate and matches only exact unique aliases", () => {
  const bundle = normalizeDiscovery(input({
    candidates: [
      row("新作", { category: "模拟经营", identity_status: "unverified", scope_status: "in_scope" }),
      row("新作"),
      row("伊莫"),
      row("共享代号"),
      row("海岛小游戏", { scope_status: "out_of_scope" }),
      row("Aniimo 新闻合集"),
    ],
    tracked_updates: [row("伊莫", { published_date: "2026-09-27", source_url: "https://example.com/aniimo-2" })],
  }), games, { today: "2026-09-28" });
  assert.deepEqual(bundle.candidates.map((item) => item.name), ["新作", "Aniimo", "共享代号", "Aniimo 新闻合集"]);
  assert.equal(bundle.candidates[0].disposition, "待人工核验");
  assert.equal(bundle.candidates[1].disposition, "已晋级");
  assert.equal(bundle.candidates[2].disposition, "身份冲突");
  assert.equal(bundle.candidates[3].identity_status, "unverified");
  assert.deepEqual(bundle.tracked_updates.map((item) => item.name), ["Aniimo"]);
  assert.equal(bundle.tracked_updates[0].event_date, null);
  assert.equal(bundle.tracked_updates[0].published_date, "2026-09-27");
  assert.equal(bundle.meta.rejected_rows, 2);
  assert.equal(bundle.candidates[0].metrics_status, "未接入 DataBrain");
});

test("the CLI never replaces a snapshot with a partial scan", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "youyansuo-discovery-test-"));
  try {
    const source = path.join(temp, "scan.json");
    const target = path.join(temp, "snapshot.json");
    fs.writeFileSync(source, JSON.stringify(input({ status: "partial" })));
    fs.writeFileSync(target, "previous snapshot");
    const result = spawnSync(process.execPath, ["scripts/normalize-youyansuo-discovery.mjs", `--input=${source}`, `--output=${target}`], { cwd: root, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(target, "utf8"), "previous snapshot");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("refresh guards reject a dirty worktree before writing public files", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "youyansuo-guard-test-"));
  try {
    const init = spawnSync("git", ["init", "-q"], { cwd: temp });
    assert.equal(init.status, 0);
    fs.writeFileSync(path.join(temp, "local.txt"), "user work");
    assert.throws(() => assertCleanWorktree(temp), /local\.txt/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("weekly rollback covers the MCP snapshot and dry-run does not write reports", () => {
  const weekly = fs.readFileSync(path.join(root, "scripts", "weekly-refresh.mjs"), "utf8");
  assert.match(weekly, /"youyansuo_discovery\.json"/);
  assert.match(weekly, /"pc-metrics\.json"/);
  assert.match(weekly, /scripts\/refresh-steam-products\.mjs/);
  assert.match(weekly, /assertCleanWorktree\(siteRoot\)/);
  const report = path.join(root, "reports", "weekly-refresh-latest.json");
  const before = fs.existsSync(report) ? fs.readFileSync(report) : null;
  const result = spawnSync(process.execPath, ["scripts/weekly-refresh.mjs", "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const after = fs.existsSync(report) ? fs.readFileSync(report) : null;
  assert.deepEqual(after, before);
});

test("out-of-scope rhythm/IP products stay out of the intelligence panel", () => {
  const discovery = JSON.parse(fs.readFileSync(path.join(root, "public", "youyansuo_discovery.json"), "utf8"));
  assert.equal(discovery.tracked_updates.some((item) => item.name === "BanG Dream! Our Notes"), false);
  assert.equal(discovery.meta.excluded_rows?.find((item) => item.name === "BanG Dream! Our Notes")?.scope_status, "out_of_scope");
});

test("excluded merge games cannot return through candidates, tracked updates or product feeds", () => {
  const bundle = normalizeDiscovery(input({
    candidates: [row("Yumtopia", { scope_status: "in_scope", scope_reason: "餐厅经营题材" })],
    tracked_updates: [row("Yumtopia: Merge & Cook", { scope_status: "in_scope" })],
  }), { games: [{ name: "Yumtopia", aliases: ["Yumtopia: Merge & Cook"] }] }, { today: "2026-09-28" });
  assert.deepEqual(bundle.candidates, []);
  assert.deepEqual(bundle.tracked_updates, []);
  assert.equal(bundle.meta.rejected_rows, 2);
  assert.ok(bundle.meta.excluded_rows.every((item) => /典型二合/.test(item.scope_reason)));
  for (const file of ["games.json", "dashboard_data.json"]) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "public", file), "utf8")).games.some((game) => game.name === "Yumtopia"), false);
  }
  for (const file of ["game-intake.json", "development-profiles.json", "pipeline-icons.json"]) {
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(root, "public", file), "utf8")), "Yumtopia"), false);
  }
  const discovery = JSON.parse(fs.readFileSync(path.join(root, "public", "youyansuo_discovery.json"), "utf8"));
  assert.equal([...discovery.candidates, ...discovery.tracked_updates].some((item) => item.name === "Yumtopia"), false);
  assert.match(discovery.meta.excluded_rows.find((item) => item.name === "Yumtopia").scope_reason, /典型二合/);
});

test("editorial candidate selection retains only the two approved products", () => {
  const discovery = JSON.parse(fs.readFileSync(path.join(root, "public", "youyansuo_discovery.json"), "utf8"));
  assert.deepEqual(discovery.candidates.map((item) => item.name).sort(), ["Dear Passengers", "Project63"]);
  const removed = discovery.meta.excluded_rows.filter((item) => item.decision_source === "用户候选筛选");
  assert.equal(removed.length, 10);
  const bundle = normalizeDiscovery(input({ candidates: removed.map((item) => row(item.name, { scope_status: "in_scope" })) }), games, { today: "2026-09-28" });
  assert.equal(bundle.candidates.length, 0);
});

test("promoted products have distinct verified icons or an explicit pending monogram", () => {
  const names = ["火人冲冲冲", "奇遇动物城", "未眠野", "Dressmaker", "源初之结", "时之铃", "蓝色星原：旅谣"];
  const games = JSON.parse(fs.readFileSync(path.join(root, "public", "games.json"), "utf8")).games;
  const dashboard = JSON.parse(fs.readFileSync(path.join(root, "public", "dashboard_data.json"), "utf8")).games;
  const icons = JSON.parse(fs.readFileSync(path.join(root, "public", "pipeline-icons.json"), "utf8"));
  const paths = new Set();

  for (const name of names) {
    const product = games.find((item) => item.name === name);
    const copy = dashboard.find((item) => item.name === name);
    assert.ok(product, name);
    assert.equal(product.icon_path, copy?.icon_path);
    assert.equal(product.icon_path, icons[name]?.path);
    assert.ok(!paths.has(product.icon_path), `${name} shares an icon`);
    paths.add(product.icon_path);
    assert.ok(fs.existsSync(path.join(root, "public", product.icon_path.slice(1))), name);
    if (name === "火人冲冲冲") {
      assert.match(product.icon_source, /文字占位/);
      assert.equal(icons[name].source, "editorial-placeholder");
    } else {
      assert.match(product.icon_source, /TapTap/);
      assert.match(icons[name].pageUrl, /^https:\/\/www\.taptap\.cn\/app\/\d+/);
      assert.match(icons[name].imageUrl, /^https:\/\/img-tc\.tapimg\.com\//);
      assert.equal(icons[name].source, "taptap");
    }
  }
});

test("promoted product details retain sourced gameplay, team and real lifecycle dates", () => {
  const names = ["火人冲冲冲", "奇遇动物城", "未眠野", "源初之结", "时之铃", "蓝色星原：旅谣"];
  const dashboard = JSON.parse(fs.readFileSync(path.join(root, "public", "dashboard_data.json"), "utf8"));
  const games = JSON.parse(fs.readFileSync(path.join(root, "public", "games.json"), "utf8")).games;

  for (const name of names) {
    const product = games.find((item) => item.name === name);
    const detail = dashboard.pipelineDetails[name];
    assert.ok(product, name);
    assert.ok(detail, name);
    assert.equal(product.developer, detail.developer);
    assert.ok(product.profile.source_url.some((source) => source.type === "公众号原文"));
    assert.ok(detail.team.studio && detail.team.note, `${name} team`);
    assert.ok(detail.team.sources?.length, `${name} team sources`);
    assert.ok(detail.analysis.core_loop.length > 20, `${name} gameplay`);
    assert.ok(detail.analysis.differentiation.length > 20, `${name} differentiation`);
    assert.ok(detail.assessment.strengths.every((item) => item.evidence_refs.length > 0));
    assert.ok(detail.assessment.risks.every((item) => item.evidence_refs.length > 0));
    assert.equal(detail.assessment.source.url, product.intelligence.recent_articles.find((article) => article.title === detail.assessment.source.title)?.url);
    assert.notEqual(detail.assessment.source.url, "https://ai.xianjianwendao.com/kb/mcp/mcp");
    for (const record of detail.testing.records) {
      assert.match(record.date, /^20\d{2}-\d{2}-\d{2}$/);
      assert.match(record.url, /^https?:\/\//);
    }
  }

  assert.equal(dashboard.pipelineDetails["奇遇动物城"].testing.records[0].lifecycle_phase, "project");
  assert.deepEqual(dashboard.pipelineDetails["未眠野"].testing.records.map((record) => record.date), ["2026-09-09", "2026-09-24"]);
  assert.match(dashboard.pipelineDetails["源初之结"].analysis.readiness, /媒体线下试玩/);
  assert.match(dashboard.pipelineDetails["奇遇动物城"].team.experience, /游戏葡萄/);
  assert.ok(dashboard.pipelineDetails["蓝色星原：旅谣"].media_reports.some((report) => report.source === "游戏葡萄"));
  assert.equal(dashboard.pipelineDetails["蓝色星原：旅谣"].testing.records.find(record => record.type === "三测").date, "2026-09-17");
  assert.equal(dashboard.pipelineDetails["时之铃"].stage_date, null);
  assert.equal(dashboard.pipelineDetails["时之铃"].media_reports[0].timeline_date_basis, "report_date");
  assert.equal(dashboard.pipelineDetails["火人冲冲冲"].stage_date, null);
  assert.equal(dashboard.pipelineDetails["火人冲冲冲"].media_reports[1].timeline_date_basis, "report_date");
});

test("Dressmaker is a released Steam product with platform-specific PC metrics", () => {
  const games = JSON.parse(fs.readFileSync(path.join(root, "public", "games.json"), "utf8")).games;
  const product = games.find((item) => item.name === "Dressmaker");
  assert.equal(product.lifecycle.pipeline, false);
  assert.equal(product.release_date, "2026-09-21");
  assert.equal(product.developer, "Cozy Lives");
  assert.equal(product.publisher, "Free Lives");
  assert.match(product.release_status, /已上线/);
  assert.equal(product.profile.release_date, product.release_date);
  assert.ok(product.profile.source_url.some((source) => source.url === "https://store.steampowered.com/app/4019220/"));
  assert.match(product.development_profile.early_team_size, /媒体报道/);
  assert.ok(product.development_profile.sources.some((source) => source.url === "https://store.steampowered.com/app/4019220/"));
  assert.equal(product.intelligence.media_coverage, product.intelligence.recent_articles.filter((article) => article.type !== "官方更新").length);
  assert.ok(product.intelligence.recent_articles.some((article) => article.date === "2026-09-30" && article.source.includes("触乐") && article.title.includes("裁缝")));
  assert.deepEqual(product.intelligence.recent_articles.filter((article) => article.type === "官方更新").map((article) => article.date), ["2026-09-25", "2026-09-22"]);
  assert.match(product.profile.gameplay, /居民委托/);
  assert.doesNotMatch(product.profile.gameplay, /不以订单/);
  assert.deepEqual(product.metrics, {});
  const metric = JSON.parse(fs.readFileSync(path.join(root, "public", "pc-metrics.json"), "utf8")).games.Dressmaker;
  const trend = JSON.parse(fs.readFileSync(path.join(root, "public", "pc-trends.json"), "utf8")).games.Dressmaker;
  assert.ok(metric.average_ccu > 0);
  assert.ok(metric.peak_ccu >= metric.average_ccu);
  assert.ok(metric.reviews_count > 0);
  assert.ok(metric.review_score > 0 && metric.review_score <= 100);
  assert.equal(metric.revenue_30d, null);
  assert.equal(metric.sales_units, null);
  assert.match(metric.source_url, /steamcharts\.com\/app\/4019220/);
  assert.match(metric.field_sources.review_score.url, /store\.steampowered\.com\/appreviews\/4019220/);
  assert.equal(trend.activity.scope, "PC / Steam");
  assert.ok(trend.activity.points.length > 0);
  assert.equal(trend.revenue.points.length, 0);
  assert.match(trend.note, /不是 DAU/);
});

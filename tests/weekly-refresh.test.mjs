import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildGameEntityIndex, canonicalGameName, chunk, defaultEndDate, isLowConfidenceEventSource, loadTrackedGames, matchesEntityEvidence, queryNamesForGame, resolveRange, validateDailyRefresh, validateRefresh } from "../scripts/weekly-refresh-lib.mjs";
import { acquireRefreshLock, writeRefreshReport } from "../scripts/refresh-runner-lib.mjs";
import { buildAnomalyAttributionBundle } from "../scripts/anomaly-attribution-lib.mjs";
import { normalizeResearchRow, normalizeRow, parseResponseRows, queryText, collectBatchResults } from "../scripts/fetch-databrain-events.mjs";
import { validateMetricCheckpoint } from "../scripts/weekly-refresh-lib.mjs";

test("checkpoint resume rejects stale, partial or differently scoped collection", () => {
  const now = new Date("2026-10-08T08:00:00Z"), range = { start: "2026-06-26", end: "2026-10-07" };
  const manifest = { created_at: now.toISOString(), query_range: [range.start, range.end], batches: [{ status: "complete", bi_data_parts: 1, session_id: "real-session", file: "databrain_latest_90d_batch1.json", games: [{ canonical: "Demo" }] }] };
  assert.doesNotThrow(() => validateMetricCheckpoint(manifest, range, [{ canonical: "Demo" }], now));
  assert.throws(() => validateMetricCheckpoint({ ...manifest, created_at: "2026-10-07T08:00:00Z" }, range, [{ canonical: "Demo" }], now), /today/);
  assert.throws(() => validateMetricCheckpoint(manifest, range, [{ canonical: "Another" }], now), /scope/);
  assert.throws(() => validateMetricCheckpoint({ ...manifest, batches: [{ ...manifest.batches[0], status: "failed" }] }, range, [{ canonical: "Demo" }], now), /incomplete/);
});

test("bounded batch queries preserve order and report failures without losing other results", async () => {
  let running = 0, maximum = 0;
  const results = await collectBatchResults([0, 1, 2, 3, 4], async value => {
    running++; maximum = Math.max(maximum, running);
    await new Promise(resolve => setTimeout(resolve, 5)); running--;
    if (value === 2) throw new Error("denied"); return value * 10;
  }, 3);
  assert.equal(maximum, 3);
  assert.deepEqual(results.map(result => result.result ?? result.error.message), [0, 10, "denied", 30, 40]);
});

test("rejects non-game homonyms while retaining actual product updates", () => {
  const games = ["PEAK", "珊瑚岛", "WePlay"].map(name => ({ name }));
  const index = buildGameEntityIndex(games);
  const aliases = new Map(index.entities.map(game => [game.canonical, game.queryNames]));
  const requested = new Set(games.map(game => game.name));
  const rows = [
    { game_name: "PEAK", title: "A Quiet Fix That Stabilized Database Latency", summary: "改善高峰期（peak periods）的数据库延迟" },
    { game_name: "珊瑚岛", title: "普吉岛旅游与珊瑚岛", summary: "度假酒店可前往珊瑚岛" },
    { game_name: "WePlay", title: "WePlay展会亮相", summary: "WePlay展会的游戏外设" },
  ];
  for (const row of rows) {
    const record = { ...row, event_date: "2026-10-01", published_date: "2026-10-01", source: "资讯媒体", url: "https://example.com/article" };
    assert.equal(normalizeRow(record, index, aliases, requested, "2026-07-10", "2026-10-07"), null);
    assert.equal(normalizeResearchRow(record, index, aliases, requested, "2026-07-10", "2026-10-07"), null);
  }
  for (const game of games) {
    const record = { game_name: game.name, title: `${game.name} 游戏版本更新`, summary: `${game.name} 新增游戏内容`, event_date: "2026-10-01", published_date: "2026-10-01", source: "官方公告", url: "https://example.com/game-update" };
    assert.ok(normalizeRow(record, index, aliases, requested, "2026-07-10", "2026-10-07"));
    assert.ok(normalizeResearchRow(record, index, aliases, requested, "2026-07-10", "2026-10-07"));
  }
});

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("builds a rolling Shanghai-time refresh range", () => {
  assert.equal(defaultEndDate(new Date("2026-09-20T02:00:00Z")), "2026-09-19");
  assert.deepEqual(resolveRange("2026-09-19", 90), { start: "2026-06-22", end: "2026-09-19", days: 90 });
});

test("derives query names and batches from the tracked games file", () => {
  const games = loadTrackedGames(path.join(projectRoot, "public", "games.json"));
  assert.ok(games.length >= 100);
  assert.deepEqual(games.find((game) => game.canonical === "妖妖棋"), { canonical: "妖妖棋", queryName: "Yaoyao Chess", queryNames: ["Yaoyao Chess", "妖妖棋", "代号：妖鬼"] });
  assert.deepEqual(games.find((game) => game.canonical === "王者万象棋"), { canonical: "王者万象棋", queryName: "王者万象棋", queryNames: ["王者万象棋", "Honor of Kings: Chess"] });
  assert.deepEqual(games.find((game) => game.canonical === "Aniimo")?.queryNames, ["Aniimo", "伊莫"]);
  assert.deepEqual(games.find((game) => game.canonical === "多多自走棋")?.queryNames, ["Auto Chess:Origin", "多多自走棋", "Auto Chess"]);
  assert.equal(games.filter((game) => game.canonical === "山海奇旅").length, 1);
  assert.deepEqual(queryNamesForGame({ name: "Demo", name_cn: "演示", aliases: ["Project Demo", "演示"] }), ["演示", "Demo", "Project Demo"]);
  assert.deepEqual(queryNamesForGame({ name: "Demo", aliases: ["旧代号", "Demo"] }), ["Demo", "旧代号"]);
  assert.deepEqual(queryNamesForGame({ name: "Demo", grp_queries: ["不再读取"] }), ["Demo"]);
  assert.deepEqual(queryNamesForGame({ name: "粒粒的小人国", en: "Animula Nook / Lili's Tiny Kingdom" }), ["Animula Nook / Lili's Tiny Kingdom", "Animula Nook", "Lili's Tiny Kingdom", "粒粒的小人国"]);
  assert.equal(matchesEntityEvidence(["妖妖棋", "代号：妖鬼"], ["《代号：妖鬼》奇谭论道测试开启", "网易中式自走棋", "https://yyq.163.com/"]), true);
  assert.equal(matchesEntityEvidence(["妖妖棋", "代号：妖鬼"], ["出租车接管活动延长", "Gangstar Mirage City", "https://example.com/gangstar"]), false);
  assert.equal(isLowConfidenceEventSource("91手游网", "https://www.91danji.com/apk/1403133.html"), true);
  assert.equal(isLowConfidenceEventSource("Aniimo 官方", "https://www.aniimo.com/"), false);
  assert.equal(isLowConfidenceEventSource("3322软件站", "https://example.com/"), true);
  assert.equal(isLowConfidenceEventSource("APKFab", "https://apkfab.com/game/download"), true);
  assert.equal(isLowConfidenceEventSource("TapTap / 多多软件站", "https://example.com/game"), true);
  assert.equal(isLowConfidenceEventSource("PP助手", "https://example.com/game"), true);
  assert.equal(isLowConfidenceEventSource("This sentence was incorrectly returned as the source name and is far too long to identify a publisher or channel.", ""), true);
  assert.equal(isLowConfidenceEventSource("微信公众号资料库", ""), false);
  assert.equal(chunk(games, 18).flat().length, games.length);
});

test("uses one product entity registry across metrics, events, GRP and search aliases", () => {
  const document = JSON.parse(fs.readFileSync(path.join(projectRoot, "public", "games.json"), "utf8"));
  const index = buildGameEntityIndex(document.games);
  assert.equal(canonicalGameName("代号：妖鬼", index), "妖妖棋");
  assert.equal(canonicalGameName("伊莫", index), "Aniimo");
  assert.equal(canonicalGameName("Identity V", index), "第五人格");
  assert.equal(canonicalGameName("Hearthstone: Heroes of Warcraft", index), "炉石传说：酒馆战棋");
  assert.ok(document.games.every((game) => !("grp_queries" in game)));
  assert.deepEqual(document.meta.entity_identity.applies_to, ["DataBrain metrics", "DataBrain events", "GRP reports", "official and media research", "dashboard search", "deduplication"]);
});

test("scans aliases across events and research while keeping publication-only rows out of event timelines", () => {
  const games = loadTrackedGames(path.join(projectRoot, "public", "games.json"));
  const aliases = new Map(games.map((game) => [game.canonical, game.queryNames]));
  const query = queryText(games.map((game) => game.canonical), aliases, "2026-06-01", "2026-09-20", 8);
  assert.match(query, /微信公众号资料库/);
  assert.match(query, /Aniimo（别名：伊莫）/);
  assert.match(query, /妖妖棋（别名：Yaoyao Chess、代号：妖鬼）/);
  assert.equal((query.match(/（别名：/g) || []).length > 0, true);

  const source = JSON.parse(fs.readFileSync(path.join(projectRoot, "public", "games.json"), "utf8"));
  const entityIndex = buildGameEntityIndex(source.games);
  const requested = new Set(["Aniimo"]);
  const markdown = `| game_name | record_type | event_date | published_date | title | summary | source | url | date_meaning |\n|---|---|---|---|---|---|---|---|---|\n| 伊莫 | research |  | 2026-07-10 | 《伊莫》三测产品分析 | 伊莫三测商业化与长线风险 | GRP | https://example.com/aniimo | 报告发布日期 |`;
  const [row] = parseResponseRows(markdown, []);
  assert.equal(normalizeRow(row, entityIndex, aliases, requested, "2026-06-01", "2026-09-20"), null);
  assert.deepEqual(normalizeResearchRow(row, entityIndex, aliases, requested, "2026-06-01", "2026-09-20"), {
    game_name: "Aniimo",
    published_date: "2026-07-10",
    title: "《伊莫》三测产品分析",
    summary: "伊莫三测商业化与长线风险",
    source: "GRP",
    url: "https://example.com/aniimo",
    content_type: "research",
  });
});

test("accepts a healthy refresh and rejects partial entity coverage or failed research batches", () => {
  const before = { trend_games: 80, activity_games_80d: 76, mobile_games: 20, pc_games: 50 };
  const healthy = {
    trend_games: 79,
    activity_games_80d: 75,
    mobile_games: 20,
    pc_games: 49,
    failed_event_batches: 0,
    failed_research_batches: 0,
    tracked_games: 121,
    event_games_queried: 121,
    research_games_queried: 121,
    query_range: ["2026-06-17", "2026-09-14"],
    anomaly_alerts: 3,
    anomaly_attributions: 3,
    uncovered_anomalies: 0,
  };
  assert.deepEqual(validateRefresh(before, healthy, { start: "2026-06-08", end: "2026-09-19", windowDays: 90 }), []);
  const unhealthy = { ...healthy, trend_games: 60, activity_games_80d: 50, failed_event_batches: 1 };
  assert.ok(validateRefresh(before, unhealthy, { start: "2026-06-08", end: "2026-09-19", windowDays: 90 }).length >= 2);
  assert.match(validateRefresh(before, { ...healthy, event_games_queried: 120, research_games_queried: 119, failed_research_batches: 1 }, { start: "2026-06-08", end: "2026-09-19", windowDays: 90 }).join("；"), /事件扫描仅覆盖 120\/121.*研究资料扫描仅覆盖 119\/121/);
});

test("daily refresh advances snapshots without requiring weekly trend changes", () => {
  const before = { mobile_games: 20, pc_games: 50, metrics_query_range: ["2026-08-09", "2026-09-18"] };
  const healthy = { mobile_games: 20, pc_games: 49, metrics_query_range: ["2026-08-09", "2026-09-19"] };
  assert.deepEqual(validateDailyRefresh(before, healthy, { start: "2026-08-09", end: "2026-09-19" }), []);
  assert.match(validateDailyRefresh(before, { ...healthy, metrics_query_range: ["2026-08-08", "2026-09-17"] }, { start: "2026-08-09", end: "2026-09-19" }).join("；"), /回退/);
  assert.match(validateDailyRefresh(before, { ...healthy, mobile_games: 4, pc_games: 5 }, { start: "2026-08-09", end: "2026-09-19" }).join("；"), /覆盖/);
});

test("refresh lock rejects overlap and can be reacquired after release", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "refresh-lock-test-"));
  const lockPath = path.join(root, "refresh.lock");
  const release = acquireRefreshLock(lockPath, { now: new Date("2026-09-20T02:00:00Z") });
  assert.throws(() => acquireRefreshLock(lockPath, { now: new Date("2026-09-20T02:01:00Z") }), /正在运行/);
  release();
  const releaseAgain = acquireRefreshLock(lockPath, { now: new Date("2026-09-20T02:02:00Z") });
  releaseAgain();
  fs.rmSync(root, { recursive: true, force: true });
});

test("archives every refresh report and only records successful publication for complete runs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "refresh-report-test-"));
  const reportPath = path.join(root, "weekly-refresh-latest.json");
  const planned = { cadence: "weekly", started_at: "2026-09-21T01:00:00.000Z", status: "planned", publication: { status: "not_started" } };
  const historyPath = writeRefreshReport(reportPath, planned);
  assert.ok(fs.existsSync(historyPath));
  const rejected = spawnSync(process.execPath, ["scripts/record-publication.mjs", `--report=${reportPath}`, "--cadence=weekly", "--url=https://example.com", "--version-id=v1", "--deployment-id=d1"], { cwd: projectRoot, encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /只有 complete 报告可以记录成功发布/);

  writeRefreshReport(reportPath, { ...planned, status: "complete" });
  const accepted = spawnSync(process.execPath, ["scripts/record-publication.mjs", `--report=${reportPath}`, "--cadence=weekly", "--url=https://example.com", "--version-id=v1", "--deployment-id=d1"], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr);
  const published = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const archived = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  assert.equal(published.publication.status, "succeeded");
  assert.equal(archived.publication.deployment_id, "d1");
  fs.rmSync(root, { recursive: true, force: true });
});

test("weekly rollback protects GRP-synchronized entity and dashboard files", () => {
  const source = fs.readFileSync(path.join(projectRoot, "scripts", "weekly-refresh.mjs"), "utf8");
  assert.match(source, /"games\.json"/);
  assert.match(source, /"dashboard_data\.json"/);
  assert.match(source, /"databrain_research\.json"/);
  assert.match(source, /"--batch-size=6"/);
  assert.match(source, /"--merge"/);
  const eventSource = fs.readFileSync(path.join(projectRoot, "scripts", "fetch-databrain-events.mjs"), "utf8");
  assert.match(eventSource, /maxAttempts = 3/);
  assert.match(eventSource, /transient DataBrain error; retry/);
});

test("weekly metric merge never replaces a fuller trend with a sparse response", () => {
  const source = fs.readFileSync(path.join(projectRoot, "scripts", "build-latest-databrain.mjs"), "utf8");
  assert.match(source, /trendCompleteness/);
  assert.match(source, /trendCompleteness\(refreshed\) >= trendCompleteness\(previous\)/);
});

test("every detected anomaly receives a window-bound attribution or a sourced inconclusive review", () => {
  const values = Array.from({ length: 35 }, (_, index) => {
    const date = new Date("2026-08-01T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), value: index < 28 ? 100 : 200 };
  });
  const bundle = buildAnomalyAttributionBundle({
    trends: { Demo: { source: "test", activity: { label: "DAU", scope: "移动端全球", granularity: "daily", points: values } } },
    games: [{ name: "Demo", platform: "移动端" }],
    events: { Demo: [] },
    eventMeta: { query_range: ["2026-08-01", "2026-09-04"], sessions: [{ games: ["Demo"], system_url: "https://databrain.woa.com/v2/agent/chat?sessionId=test" }] },
    asOf: "2026-09-04",
    reviewedAt: "2026-09-05",
  });
  assert.equal(bundle.meta.alerts, 1);
  assert.equal(bundle.meta.uncovered_alerts, 0);
  assert.equal(bundle.games.Demo.status, "inconclusive");
  assert.equal(bundle.games.Demo.summary, "暂未发现同期事件");
  assert.equal(bundle.games.Demo.signalKeys.length, 1);
});

test("keeps anomaly copy concise when a matching event exists", () => {
  const values = Array.from({ length: 35 }, (_, index) => {
    const date = new Date("2026-08-01T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), value: index < 28 ? 100 : 200 };
  });
  const bundle = buildAnomalyAttributionBundle({
    trends: { Demo: { source: "test", activity: { label: "DAU", scope: "移动端全球", granularity: "daily", points: values } } },
    games: [{ name: "Demo", platform: "移动端" }],
    events: { Demo: [{ event_date: "2026-09-03", title: "版本 1.2 更新", source: "官方", url: "https://example.com/update" }] },
    asOf: "2026-09-04",
    reviewedAt: "2026-09-05",
  });
  assert.equal(bundle.games.Demo.summary, "可能原因：9/3 版本 1.2 更新");
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveRange, snapshotSummary, validateRefresh } from "./weekly-refresh-lib.mjs";
import { acquireRefreshLock, assertCleanWorktree, backupFiles, commitStagedArtifacts, publicationReport, restoreFiles, writeRefreshReport } from "./refresh-runner-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(siteRoot, "..");
const publicRoot = path.join(siteRoot, "public");
const reportRoot = path.join(siteRoot, "reports");
const reportPath = path.join(reportRoot, "weekly-refresh-latest.json");
const lockPath = path.join(siteRoot, ".automation", "refresh.lock");
const protectedFiles = [
  "databrain_trends_90d.json",
  "databrain_latest_metrics.json",
  "pc-metrics.json",
  "pc-trends.json",
  "databrain_events.json",
  "databrain_research.json",
  "anomaly-attributions.json",
  "youyansuo_discovery.json",
  "games.json",
  "dashboard_data.json",
];

function arg(name, fallback = "") {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function run(label, command, args) {
  process.stdout.write(`\n[weekly-refresh] ${label}\n`);
  const result = spawnSync(command, args, { cwd: siteRoot, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}失败（退出码 ${result.status ?? "unknown"}）`);
}

function writeReport(report) {
  writeRefreshReport(reportPath, report);
}

function hostingProjectId() {
  try { return JSON.parse(fs.readFileSync(path.join(siteRoot, ".openai", "hosting.json"), "utf8")).project_id; } catch { return null; }
}

function main() {
  const fetchRange = resolveRange(arg("--end"), Number(arg("--fetch-days", "104")));
  const windowDays = Math.max(1, Number(arg("--window-days", "90")) || 90);
  const dryRun = process.argv.includes("--dry-run");
  const reuseMetrics = process.argv.includes("--reuse-metrics");
  const skipTests = process.argv.includes("--skip-tests");
  const youyansuoInput = arg("--youyansuo-input", "");
  const before = snapshotSummary(publicRoot);
  const startedAt = new Date().toISOString();
  const baseReport = {
    cadence: "weekly",
    started_at: startedAt,
    requested_range: [fetchRange.start, fetchRange.end],
    display_window_days: windowDays,
    before,
    publication: publicationReport(hostingProjectId()),
    youyansuo: { status: youyansuoInput ? "planned" : "skipped", candidates: 0, tracked_updates: 0 },
  };

  if (dryRun) {
    run("检查动态批次与日期计划", process.execPath, [
      "scripts/fetch-databrain-trends.mjs",
      "--dry-run",
      `--start=${fetchRange.start}`,
      `--end=${fetchRange.end}`,
      `--window-days=${windowDays}`,
    ]);
    return;
  }

  assertCleanWorktree(siteRoot);

  if (!String(process.env.DATABRAIN_TOKEN || "").trim()) {
    throw new Error("DATABRAIN_TOKEN 未设置，无法执行每周刷新。");
  }

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const releaseLock = acquireRefreshLock(lockPath);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "casual-radar-weekly-"));
  const backupDirectory = path.join(stageRoot, "backup");
  const present = backupFiles(publicRoot, protectedFiles, backupDirectory);
  let steamProducts = { status: "not_run" };
  try {
    if (!reuseMetrics) {
      run("刷新 DataBrain 指标", process.execPath, [
        "scripts/fetch-databrain-trends.mjs",
        `--start=${fetchRange.start}`,
        `--end=${fetchRange.end}`,
        `--window-days=${windowDays}`,
        `--output-root=${path.join(stageRoot, "outputs")}`,
      ]);
    } else {
      fs.mkdirSync(path.join(stageRoot, "outputs"), { recursive: true });
      fs.cpSync(path.join(workspaceRoot, "outputs"), path.join(stageRoot, "outputs"), { recursive: true, force: true });
    }
    run("生成最近90天公开快照", process.execPath, ["scripts/build-latest-databrain.mjs", "--merge", `--output-root=${path.join(stageRoot, "outputs")}`, `--bi-root=${path.join(stageRoot, "bi_data")}`]);
    const steamBackupRoot = path.join(stageRoot, "steam-backup");
    const steamFiles = ["pc-metrics.json", "pc-trends.json"];
    const steamPresent = backupFiles(publicRoot, steamFiles, steamBackupRoot);
    try {
      run("刷新 Steam 公开在线与评价", process.execPath, ["scripts/refresh-steam-products.mjs"]);
      steamProducts = { status: "complete" };
    } catch (error) {
      restoreFiles(publicRoot, steamFiles, steamBackupRoot, steamPresent);
      steamProducts = { status: "failed_previous_snapshot_retained", error: error instanceof Error ? error.message : String(error) };
      process.stderr.write(`[weekly-refresh] Steam 来源失败，保留上次快照：${steamProducts.error}\n`);
    }
    const metricsSummary = snapshotSummary(publicRoot);
    const [eventStart] = metricsSummary.query_range;
    run("扫描全部产品事件与研究资料", process.execPath, [
      "scripts/fetch-databrain-events.mjs",
      `--start=${eventStart || fetchRange.start}`,
      `--end=${fetchRange.end}`,
      "--batch-size=6",
    ]);
    run("按产品别名归并 GRP 测试报告", process.execPath, ["scripts/sync-grp-reports.mjs"]);
    run("生成本期异动归因", process.execPath, ["--experimental-strip-types", "scripts/build-anomaly-attributions.mjs"]);
    if (youyansuoInput) {
      run("规范化游研所产品情报", process.execPath, ["scripts/normalize-youyansuo-discovery.mjs", `--input=${path.resolve(youyansuoInput)}`]);
    }

    run("同步已核验新品的厂商归属", process.execPath, ["scripts/sync-studio-associations.mjs"]);
    run("归并已核验首曝 PV 与实机", process.execPath, ["scripts/sync-pipeline-reveal-media.mjs"]);
    const after = snapshotSummary(publicRoot);
    const errors = validateRefresh(before, after, { ...fetchRange, windowDays });
    if (errors.length) throw new Error(`安全校验未通过：${errors.join("；")}`);
    if (!skipTests) run("运行构建与测试", "npm", ["test"]);
    commitStagedArtifacts(stageRoot, path.join(workspaceRoot, "outputs"), path.join(workspaceRoot, "bi_data"));

    writeReport({
      ...baseReport,
      status: "complete",
      completed_at: new Date().toISOString(),
      after,
      changes: {
        trend_games: after.trend_games - before.trend_games,
        mobile_games: after.mobile_games - before.mobile_games,
        pc_games: after.pc_games - before.pc_games,
        event_games: after.event_games - before.event_games,
        events: after.events - before.events,
        research_games: after.research_games - before.research_games,
        research_records: after.research_records - before.research_records,
      },
      reused_metric_batches: reuseMetrics,
      steam_products: steamProducts,
      youyansuo: youyansuoInput
        ? (() => {
          const bundle = JSON.parse(fs.readFileSync(path.join(publicRoot, "youyansuo_discovery.json"), "utf8"));
          return { status: bundle.meta?.status || "unknown", scan_date: bundle.meta?.scan_date || null, candidates: bundle.meta?.candidates || 0, tracked_updates: bundle.meta?.tracked_updates || 0, tool_calls: bundle.meta?.tool_calls || {} };
        })()
        : { status: "skipped", candidates: 0, tracked_updates: 0 },
      checks: { guardrails: "passed", tests: skipTests ? "skipped" : "passed", steam_source: steamProducts.status },
    });
    process.stdout.write(`\n[weekly-refresh] 完成。内部审阅报告：${reportPath}\n`);
  } catch (error) {
    restoreFiles(publicRoot, protectedFiles, backupDirectory, present);
    const message = error instanceof Error ? error.message : String(error);
    writeReport({ ...baseReport, status: "failed", completed_at: new Date().toISOString(), error: message, rollback: "completed", youyansuo: { ...baseReport.youyansuo, status: "failed", error: message } });
    throw error;
  } finally {
    releaseLock();
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

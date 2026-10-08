import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveRange, snapshotSummary, validateDailyRefresh } from "./weekly-refresh-lib.mjs";
import { acquireRefreshLock, assertCleanWorktree, backupFiles, commitStagedArtifacts, publicationReport, restoreFiles, writeRefreshReport } from "./refresh-runner-lib.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(siteRoot, "..");
const publicRoot = path.join(siteRoot, "public");
const reportRoot = path.join(siteRoot, "reports");
const reportPath = path.join(reportRoot, "daily-refresh-latest.json");
const lockPath = path.join(siteRoot, ".automation", "refresh.lock");
const protectedFiles = ["databrain_latest_metrics.json"];

function arg(name, fallback = "") {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1) || fallback;
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

let activeSource = "preflight";
const sourceModules = {};
function run(label, command, args) {
  const names = /DataBrain|指标|快照/.test(label) ? ["metrics"] : /Steam/.test(label) ? ["steam"] : /事件与研究/.test(label) ? ["events", "research"] : /GRP/.test(label) ? ["grp"] : /异动/.test(label) ? ["attributions"] : /游研所/.test(label) ? ["intelligence"] : [];
  if (names.length) activeSource = names[0];
  for (const name of names) sourceModules[name] = { required: true, status: "running" };
  process.stdout.write(`\n[daily-refresh] ${label}\n`);
  const result = spawnSync(command, args, { cwd: siteRoot, env: process.env, stdio: "inherit" });
  if (result.error || result.status !== 0) {
    for (const name of names) sourceModules[name] = { required: true, status: "failed", error: `${label}失败` };
    throw result.error || new Error(`${label}失败（退出码 ${result.status ?? "unknown"}）`);
  }
  for (const name of names) sourceModules[name] = { required: true, status: "passed" };
}

function writeReport(report) {
  writeRefreshReport(reportPath, report);
}

function hostingProjectId() {
  try { return JSON.parse(fs.readFileSync(path.join(siteRoot, ".openai", "hosting.json"), "utf8")).project_id; } catch { return null; }
}

function main() {
  const fetchRange = resolveRange(arg("--end"), Number(arg("--fetch-days", "42")));
  const dryRun = process.argv.includes("--dry-run");
  const skipBuild = process.argv.includes("--skip-build");
  const before = snapshotSummary(publicRoot);
  const baseReport = {
    cadence: "daily",
    started_at: new Date().toISOString(),
    requested_range: [fetchRange.start, fetchRange.end],
    scope: "current_metric_snapshots_only",
    before,
    publication: publicationReport(hostingProjectId()),
  };

  if (dryRun) {
    run("检查指标批次与日期计划", process.execPath, ["scripts/fetch-databrain-trends.mjs", "--dry-run", `--start=${fetchRange.start}`, `--end=${fetchRange.end}`, "--window-days=42"]);
    return;
  }
  writeReport({ ...baseReport, status: "running", modules: { source: { required: true, status: "running" } } });
  assertCleanWorktree(siteRoot);
  if (!String(process.env.DATABRAIN_TOKEN || "").trim()) throw new Error("DATABRAIN_TOKEN 未设置，无法执行每日刷新。");

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const releaseLock = acquireRefreshLock(lockPath);
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "casual-radar-daily-"));
  const backupRoot = path.join(stageRoot, "backup");
  const present = backupFiles(publicRoot, protectedFiles, backupRoot);
  let began = false;
  try {
    run("保存整批内容基线", process.execPath, ["scripts/content-workflow.mjs", "begin", "--cadence=daily"]); began = true;
    run("刷新最近42天 DataBrain 指标", process.execPath, ["scripts/fetch-databrain-trends.mjs", `--start=${fetchRange.start}`, `--end=${fetchRange.end}`, "--window-days=42", `--output-root=${path.join(stageRoot, "outputs")}`]);
    run("生成当前指标快照", process.execPath, ["scripts/build-latest-databrain.mjs", "--metrics-only", `--output-root=${path.join(stageRoot, "outputs")}`, `--bi-root=${path.join(stageRoot, "bi_data")}`]);
    const after = snapshotSummary(publicRoot);
    const errors = validateDailyRefresh(before, after, fetchRange);
    if (errors.length) throw new Error(`安全校验未通过：${errors.join("；")}`);
    if (!skipBuild) run("验证站点构建", "npm", ["run", "build:pages"]);
    commitStagedArtifacts(stageRoot, path.join(workspaceRoot, "outputs"), path.join(workspaceRoot, "bi_data"));
    writeReport({ ...baseReport, status: "ready_for_review", modules: { metrics: { required: true, status: "passed", checked_at: fetchRange.end }, build: { required: true, status: skipBuild ? "not_run" : "passed" } }, completed_at: new Date().toISOString(), after, changes: { mobile_games: after.mobile_games - before.mobile_games, pc_games: after.pc_games - before.pc_games }, checks: { guardrails: "passed", build: skipBuild ? "skipped" : "passed" } });
    process.stdout.write(`\n[daily-refresh] 完成。发布前报告：${reportPath}\n`);
  } catch (error) {
    if (began) run("回滚整批公开内容", process.execPath, ["scripts/content-workflow.mjs", "abort", "--cadence=daily"]);
    restoreFiles(publicRoot, protectedFiles, backupRoot, present);
    const message = error instanceof Error ? error.message : String(error);
    writeReport({ ...baseReport, status: "failed", modules: { ...sourceModules, [activeSource]: { required: true, status: "failed", error: message } }, failed_module: activeSource, completed_at: new Date().toISOString(), error: message, rollback: "completed" });
    throw error;
  } finally {
    releaseLock();
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}

try { main(); } catch (error) {
  const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {};
  writeReport({ ...report, cadence: "daily", status: "failed", completed_at: new Date().toISOString(), error: String(error.message || error), modules: { ...report.modules, [activeSource]: { required: true, status: "failed", error: String(error.message || error) } }, failed_module: activeSource });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

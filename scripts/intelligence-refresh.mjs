import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { acquireRefreshLock, assertCleanWorktree, writeRefreshReport, publicationReport } from "./refresh-runner-lib.mjs";
const root = path.resolve(import.meta.dirname, "..");
const reportPath = path.join(root, "reports/intelligence-refresh-latest.json");
const input = process.argv.find(value => value.startsWith("--youyansuo-input="))?.split("=").slice(1).join("=");
const run = args => execFileSync(process.execPath, args, { cwd: root, stdio: "inherit" });
let began = false, releaseLock;
const report = { cadence: "intelligence", started_at: new Date().toISOString(), status: "running", modules: { intelligence: { required: true, status: "running" } }, publication: publicationReport(null) };
writeRefreshReport(reportPath, report);
try {
  assertCleanWorktree(root);
  if (!input || !fs.existsSync(input)) throw new Error("Authenticated intelligence input is required; previous scan cannot substitute");
  fs.mkdirSync(path.join(root, ".automation"), { recursive: true });
  releaseLock = acquireRefreshLock(path.join(root, ".automation/refresh.lock"));
  run(["scripts/content-workflow.mjs", "begin", "--cadence=intelligence"]); began = true;
  run(["scripts/normalize-youyansuo-discovery.mjs", `--input=${path.resolve(input)}`]);
  run(["scripts/sync-studio-associations.mjs"]);
  run(["scripts/sync-pipeline-reveal-media.mjs"]);
  run(["scripts/content-workflow.mjs", "queue", "--cadence=intelligence"]);
  writeRefreshReport(reportPath, { ...report, status: "ready_for_review", modules: { intelligence: { required: true, status: "passed" }, editorial: { required: true, status: "not_run" } } });
} catch (error) {
  if (began) run(["scripts/content-workflow.mjs", "abort", "--cadence=intelligence"]);
  writeRefreshReport(reportPath, { ...report, status: "failed", error: String(error.message || error), rollback: began ? "completed" : "not_needed", modules: { intelligence: { required: true, status: "failed", error: String(error.message || error) } } });
  process.exitCode = 1;
} finally { releaseLock?.(); }

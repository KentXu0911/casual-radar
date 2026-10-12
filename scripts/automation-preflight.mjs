import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { githubNetwork } from "./github-network-lib.mjs";

export const shanghaiDate = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date(value));
export function publishedToday(report, now = new Date()) {
  return report?.status === "complete" && report.publication?.status === "succeeded"
    && report.publication?.health_check === "exact_commit_and_live_hashes_passed"
    && Boolean(report.started_at) && Boolean(report.publication.checked_at)
    && shanghaiDate(report.started_at) === shanghaiDate(now)
    && shanghaiDate(report.publication.checked_at) === shanghaiDate(now);
}

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const cadence = process.argv.find(arg => arg.startsWith("--cadence="))?.slice(10);
  if (!["daily", "weekly", "intelligence", "monthly"].includes(cadence)) throw new Error("A valid --cadence is required");
  const read = name => fs.existsSync(path.join(root, name)) ? JSON.parse(fs.readFileSync(path.join(root, name), "utf8")) : null;
  const report = read(`reports/${cadence}-refresh-latest.json`);
  const state = read(`.automation/content-runs/${cadence}.json`);
  const owner = read(".automation/content-runs/active/owner.json");
  if (owner && owner.cadence !== cadence) throw new Error(`Another cadence owns an unfinished batch: ${owner.cadence}`);
  for (const other of ["manual", "daily", "weekly", "intelligence", "monthly"]) {
    if (other === cadence) continue;
    const otherState = read(`.automation/content-runs/${other}.json`);
    if (["running", "finalized"].includes(otherState?.status)) throw new Error(`Another cadence has an unpublished batch: ${other}`);
  }
  let action;
  if (owner || state?.status === "finalized") {
    if (report?.run_id !== state?.run_id) throw new Error("Content state and report disagree; inspect before continuing");
    if (owner && owner.run_id !== state?.run_id) throw new Error("Content owner and state disagree; inspect before continuing");
    action = state?.status === "finalized" && ["ready_for_build", "complete"].includes(report.status) ? "publish" : "resume";
  } else if (publishedToday(report)) {
    action = "skip_already_published_today";
  } else {
    const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    if (git(["status", "--porcelain", "--untracked-files=all"])) throw new Error("Worktree has changes; inspect ownership before starting another batch");
    if (git(["branch", "--show-current"]) !== "main") throw new Error("Automation must run on main");
    if (git(["remote", "get-url", "origin"]) !== "https://github.com/KentXu0911/casual-radar.git") throw new Error("Unexpected automation repository");
    await githubNetwork("git", ["pull", "--ff-only", "origin", "main"], { cwd: root });
    action = "start";
  }
  const result = { cadence, action, checked_at: new Date().toISOString() };
  fs.mkdirSync(path.join(root, ".automation/preflight"), { recursive: true });
  fs.writeFileSync(path.join(root, `.automation/preflight/${cadence}.json`), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

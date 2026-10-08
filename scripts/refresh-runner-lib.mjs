import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function assertCleanWorktree(root) {
  const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error("无法检查 Git 工作区状态，刷新已停止。");
  const changed = result.stdout.trim();
  if (changed) throw new Error(`Git 工作区存在未提交变更，刷新已停止：\n${changed}`);
}

export function acquireRefreshLock(lockDirectory, options = {}) {
  const now = options.now || new Date();
  const staleAfterMs = options.staleAfterMs || 8 * 60 * 60 * 1000;
  const ownerPath = path.join(lockDirectory, "owner.json");
  const takeLock = () => {
    fs.mkdirSync(lockDirectory, { recursive: false });
    fs.writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid, started_at: now.toISOString() }, null, 2)}\n`);
  };

  try {
    takeLock();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let owner = {};
    try { owner = JSON.parse(fs.readFileSync(ownerPath, "utf8")); } catch {}
    const startedAt = Date.parse(owner.started_at || "");
    const stale = !Number.isFinite(startedAt) || now.getTime() - startedAt > staleAfterMs;
    let running = false;
    if (Number.isInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); running = true; } catch {}
    }
    if (!stale && running) {
      throw new Error(`已有刷新任务正在运行（PID ${owner.pid}，开始于 ${owner.started_at}）。`);
    }
    fs.rmSync(lockDirectory, { recursive: true, force: true });
    takeLock();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.rmSync(lockDirectory, { recursive: true, force: true });
  };
}

export function backupFiles(root, names, backupDirectory) {
  fs.mkdirSync(backupDirectory, { recursive: true });
  const present = [];
  for (const name of names) {
    const source = path.join(root, name);
    if (!fs.existsSync(source)) continue;
    fs.copyFileSync(source, path.join(backupDirectory, name));
    present.push(name);
  }
  return present;
}

export function restoreFiles(root, names, backupDirectory, present) {
  for (const name of names) {
    const target = path.join(root, name);
    const backup = path.join(backupDirectory, name);
    if (present.includes(name) && fs.existsSync(backup)) fs.copyFileSync(backup, target);
    else fs.rmSync(target, { force: true });
  }
}

export function commitStagedArtifacts(stageRoot, outputRoot, biRoot) {
  const stagedOutputs = path.join(stageRoot, "outputs");
  const stagedBi = path.join(stageRoot, "bi_data");
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.cpSync(stagedOutputs, outputRoot, { recursive: true, force: true });
  if (fs.existsSync(stagedBi)) {
    fs.mkdirSync(biRoot, { recursive: true });
    fs.cpSync(stagedBi, biRoot, { recursive: true, force: true });
  }
}

export function writeRefreshReport(reportPath, report) {
  const writeAtomic = (target) => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`);
    fs.renameSync(temporary, target);
  };
  writeAtomic(reportPath);
  const cadence = String(report.cadence || path.basename(reportPath).split("-")[0] || "refresh").replace(/[^a-z0-9_-]+/gi, "-");
  const startedAt = String(report.started_at || new Date().toISOString()).replace(/[^0-9TZ]+/g, "");
  const historyPath = path.join(path.dirname(reportPath), "history", `${cadence}-${startedAt}.json`);
  writeAtomic(historyPath);
  return historyPath;
}

export function publicationReport(projectId) {
  if (process.env.DASHBOARD_PUBLICATION_PROVIDER !== "openai_sites") {
    return {
      status: "not_started",
      provider: "github_pages",
      repository: "KentXu0911/casual-radar",
      commit_sha: null,
      workflow_run_id: null,
      url: null,
      checked_at: null,
    };
  }
  return {
    status: "not_started",
    provider: "openai_sites",
    project_id: projectId || null,
    version_id: null,
    deployment_id: null,
    url: null,
    checked_at: null,
  };
}

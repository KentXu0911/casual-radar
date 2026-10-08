import fs from "node:fs";
import path from "node:path";
import { runStatus } from "./content-workflow-lib.mjs";
import { publicFiles, contentVersion } from "./release-manifest-lib.mjs";
import { verifyPublication } from "./publication-verifier.mjs";
import { writeRefreshReport } from "./refresh-runner-lib.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "KentXu0911/casual-radar";
const inPlace = process.argv.includes("--in-place");
const checkout = inPlace ? root : path.join(root, ".automation", "github-pages", "repo");
const baselinePath = path.join(root, ".automation", "github-pages", "source-baseline.json");
const folders = ["app", "static", "public", "scripts", "tests", "specs", "worker", "db", "examples", "drizzle", ".github"];
const files = [".gitignore", "README.md", "package.json", "package-lock.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "tsconfig.pages.json", "eslint.config.mjs", "vite.config.ts", "vite.pages.config.ts", "drizzle.config.ts"];

function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status}).`);
  return result.stdout || "";
}

function validatePublicSource(source) {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error(`Refusing to publish a symlink: ${path.relative(root, source)}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(source)) {
      if (name.startsWith(".env") || name === ".git") throw new Error(`Private file inside public source: ${path.relative(root, source)}/${name}`);
      validatePublicSource(path.join(source, name));
    }
    return;
  }
  if (!/\.(?:[cm]?[jt]sx?|json|md|ya?ml|html|css|txt|py)$/.test(source)) return;
  const text = fs.readFileSync(source, "utf8");
  const credentials = /(?<![A-Za-z0-9_-])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|"(?:access_token|refresh_token|client_secret)"\s*:\s*"[^"\s]+"/;
  if (credentials.test(text)) throw new Error(`Potential credential in ${path.relative(root, source)}; publication stopped.`);
}

const exportOnly = process.argv.includes("--export-only");
const messageIndex = process.argv.indexOf("--message");
const message = messageIndex >= 0 ? process.argv[messageIndex + 1] : `Update Casual Radar ${new Date().toISOString().slice(0, 10)}`;
if (!message) throw new Error("Missing commit message.");

// The original checkout and its uncommitted work are never staged or reset.
for (const name of [...folders, ...files]) validatePublicSource(path.join(root, name));
if (process.argv.includes("--check-only")) {
  console.log("Public source check passed.");
  process.exit(0);
}

if (!inPlace) {
fs.mkdirSync(path.dirname(checkout), { recursive: true });
if (!fs.existsSync(path.join(checkout, ".git"))) {
  if (fs.existsSync(checkout) && fs.readdirSync(checkout).length) throw new Error("Publishing checkout already contains files without Git metadata.");
  run("gh", ["repo", "clone", repository, checkout]);
} else {
  if (run("git", ["status", "--porcelain"], checkout, true).trim()) throw new Error("Publishing checkout has uncommitted changes; inspect it before retrying.");
  const origin = run("git", ["remote", "get-url", "origin"], checkout, true).trim();
  if (!origin.endsWith(`${repository}.git`) && !origin.endsWith(repository)) throw new Error("Unexpected publishing repository.");
  run("git", ["pull", "--ff-only", "origin", "main"], checkout);
  const remoteHead = run("git", ["rev-parse", "HEAD"], checkout, true).trim();
  if (fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    if (baseline.commit !== remoteHead) throw new Error("GitHub has newer changes from another run. Merge them into the source before publishing; no source files were overwritten.");
  } else {
    throw new Error("No publishing baseline recorded. Review and synchronize the GitHub source before publishing.");
  }
}
for (const name of [...folders, ...files]) {
  const destination = path.join(checkout, name);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(root, name), destination, { recursive: true });
}
}
if (!inPlace) {
  const cadence = process.argv.find(value => value.startsWith("--cadence="))?.slice(10) || "manual";
  const sourceReport = path.join(root, "reports", `${cadence}-refresh-latest.json`);
  if (fs.existsSync(sourceReport)) {
    fs.mkdirSync(path.join(checkout, "reports"), { recursive: true });
    fs.copyFileSync(sourceReport, path.join(checkout, "reports", `${cadence}-refresh-latest.json`));
  }
}
const origin = run("git", ["remote", "get-url", "origin"], checkout, true).trim();
if (!origin.endsWith(`${repository}.git`) && !origin.endsWith(repository)) throw new Error("Unexpected publishing repository");
if (run("git", ["branch", "--show-current"], checkout, true).trim() !== "main") throw new Error("Publish from the main checkout only");
console.log(`Public source prepared in ${checkout}`);
if (!exportOnly) {
  const cadenceArg = process.argv.find(value => value.startsWith("--cadence="));
  const cadence = cadenceArg?.slice("--cadence=".length) || "manual";
  if (!["manual", "daily", "weekly", "intelligence", "monthly"].includes(cadence)) throw new Error("Invalid cadence");
  const reportPath = path.join(checkout, "reports", `${cadence}-refresh-latest.json`);
  let report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : null;
  if (!report || !["ready_for_build", "complete"].includes(report.status)) throw new Error("Finalize this content run before publishing; incomplete source/editorial modules cannot be published");
  const required = { daily: ["metrics"], weekly: ["metrics", "steam", "intelligence", "events", "research", "editorial"], intelligence: ["intelligence", "editorial"], monthly: ["editorial", "historical_media"], manual: [] }[cadence];
  let phase = "content_gate";
  try {
  if (required.some(name => !["passed", "no_change"].includes(report.modules?.[name]?.status)) || runStatus(Object.fromEntries(Object.entries(report.modules || {}).filter(([name]) => name !== "build"))) !== "complete") throw new Error("Required content modules have not passed");
    run("node", ["scripts/content-workflow.mjs", "prepare", "--baseline-ref=HEAD"], checkout);
    if (contentVersion(publicFiles(path.join(checkout, "public"))) !== report.content_version) throw new Error("Public content changed since finalize; finalize this batch again");
    phase = "build";
    run("npm", ["run", "test:pages"], checkout);
    if (contentVersion(publicFiles(path.join(checkout, "public"))) !== report.content_version) throw new Error("Build changed verified content; finalize this batch again");
    report = { ...report, status: "complete", modules: { ...report.modules, build: { required: true, status: "passed" } } };
    writeRefreshReport(reportPath, report);
    phase = "commit";
    run("git", ["add", "--", ...folders, ...files], checkout);
    const changed = run("git", ["diff", "--cached", "--name-only"], checkout, true).trim();
    if (changed) run("git", ["commit", "-m", message], checkout);
    const sha = run("git", ["rev-parse", "HEAD"], checkout, true).trim();
    phase = "deploy";
    run("git", ["push", "origin", "HEAD:main"], checkout);
    const deadline = Date.now() + 15 * 60_000;
    let deployment;
    while (Date.now() < deadline) {
      const runs = JSON.parse(run("gh", ["api", `repos/${repository}/actions/workflows/pages.yml/runs?head_sha=${sha}&per_page=10`], checkout, true)).workflow_runs;
      const latest = runs.filter(item => item.head_sha === sha).sort((a, b) => b.id - a.id)[0];
      if (latest?.status === "completed") {
        if (latest.conclusion !== "success") throw new Error(`Pages deployment failed: ${latest.html_url}`);
        deployment = latest; break;
      }
      console.log(`[publication] Waiting for Pages commit ${sha.slice(0, 8)} (${latest?.status || "queued"})`);
      await new Promise(resolve => setTimeout(resolve, 15_000));
    }
    if (!deployment) throw new Error("Timed out waiting for Pages deployment");
    const version = JSON.parse(fs.readFileSync(path.join(checkout, "public", "release-manifest.json"))).version;
    phase = "live_verification";
    let verificationError;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        report.publication = await verifyPublication({ sha, runId: deployment.id, url: "https://kentxu0911.github.io/casual-radar/", version });
        verificationError = null; break;
      } catch (error) {
        verificationError = error;
        console.log(`[publication] Live verification pending: ${error.message}`);
        if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 15_000));
      }
    }
    if (verificationError) throw verificationError;
    writeRefreshReport(reportPath, report);
    for (const taskRoot of new Set([root, checkout])) {
      const statePath = path.join(taskRoot, ".automation/content-runs", `${cadence}.json`);
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath));
        if (state.run_id === report.run_id) fs.writeFileSync(statePath, JSON.stringify({ ...state, status: "published", commit_sha: sha }));
      }
    }
    if (!inPlace) writeRefreshReport(path.join(root, "reports", `${cadence}-refresh-latest.json`), report);
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, `${JSON.stringify({ commit: sha }, null, 2)}\n`);
    console.log(JSON.stringify({ report: reportPath, publication: report.publication }));
  } catch (error) {
    report.failed_phase = phase;
    if (phase === "build") { report.status = "failed"; report.modules.build = { required: true, status: "failed" }; }
    report.publication = { ...report.publication, status: "failed", phase, checked_at: new Date().toISOString(), error: String(error.message || error) };
    writeRefreshReport(reportPath, report);
    throw error;
  }
}

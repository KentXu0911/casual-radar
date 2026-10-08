import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { synchronizeIdentities, milestoneFingerprint, applyMediaReviews, buildMediaQueue, validateContent, runStatus } from "./content-workflow-lib.mjs";
import { publicFiles, contentVersion } from "./release-manifest-lib.mjs";
import { synchronizeDiscoveredStudioProducts } from "./studio-association-lib.mjs";
import { writeRefreshReport, publicationReport } from "./refresh-runner-lib.mjs";
import { recordEvidenceIssue } from "./source-evidence-lib.mjs";
import { normalizeEntityName } from "./weekly-refresh-lib.mjs";

const root = path.resolve(import.meta.dirname, "..");
const publicRoot = path.join(root, "public");
const arg = (key, fallback = "") => process.argv.find(value => value.startsWith(`${key}=`))?.slice(key.length + 1) || fallback;
const cadence = arg("--cadence", "manual");
if (!["manual", "daily", "weekly", "intelligence", "monthly"].includes(cadence)) throw new Error("Unsupported cadence");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const read = (name, fallback) => fs.existsSync(path.join(publicRoot, name)) ? JSON.parse(fs.readFileSync(path.join(publicRoot, name), "utf8")) : fallback;
const write = (name, value) => {
  const target = path.join(publicRoot, name), data = `${JSON.stringify(value, null, 2)}\n`;
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== data) fs.writeFileSync(target, data);
};
const statePath = path.join(root, ".automation", "content-runs", `${cadence}.json`);
const reportPath = path.join(root, "reports", `${cadence}-refresh-latest.json`);
const activePath = path.join(root, ".automation", "content-runs", "active");
const command = process.argv[2] || "prepare";
if (command === "begin") {
  if (fs.existsSync(statePath) && JSON.parse(fs.readFileSync(statePath)).status === "running") throw new Error("An unfinished content run exists; finalize or abort it first");
  fs.mkdirSync(path.dirname(activePath), { recursive: true });
  if (fs.existsSync(activePath)) throw new Error("An unfinished content run holds the baseline; resume or abort its cadence first");
  fs.mkdirSync(activePath);
  const state = { run_id: randomUUID(), cadence, started_at: new Date().toISOString(), status: "running" };
  state.directory = path.join(root, ".automation", "content-runs", state.run_id);
  fs.mkdirSync(state.directory, { recursive: true });
  fs.cpSync(publicRoot, path.join(state.directory, "public"), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state));
  fs.writeFileSync(path.join(activePath, "owner.json"), JSON.stringify({ run_id: state.run_id, cadence }));
  writeRefreshReport(reportPath, { ...state, directory: undefined, status: "running", modules: {}, publication: publicationReport(null) });
  console.log(JSON.stringify({ run_id: state.run_id, baseline: path.join(state.directory, "public") }));
  process.exit(0);
}
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath)) : null;
if (command === "abort") {
  if (!state || !["running", "finalized"].includes(state.status)) throw new Error("No active content run to abort");
  if (fs.existsSync(activePath) && JSON.parse(fs.readFileSync(path.join(activePath, "owner.json"))).run_id !== state.run_id) throw new Error("Another run owns the baseline");
  fs.rmSync(publicRoot, { recursive: true, force: true });
  fs.cpSync(path.join(state.directory, "public"), publicRoot, { recursive: true });
  fs.rmSync(activePath, { recursive: true, force: true });
  state.status = "failed";
  fs.writeFileSync(statePath, JSON.stringify(state));
  writeRefreshReport(reportPath, { ...state, directory: undefined, status: "failed", rollback: "completed", error: arg("--reason", "Content run aborted"), publication: publicationReport(null) });
  process.exit(0);
}
const dashboard = read("dashboard_data.json"), games = read("games.json");
const catalogue = synchronizeIdentities(dashboard, games);
synchronizeDiscoveredStudioProducts(dashboard, games);
const archive = read("media-reviews.json", { schema_version: 1, reviews: {} });
for (const detail of Object.values(dashboard.pipelineDetails)) {
  for (const record of detail.testing?.records || []) {
    const review = record.media_review;
    if (archive.reviews[record.milestone_id] || review?.status !== "matched") continue;
    const urls = review.urls || [];
    const videos = (detail.gameplay_videos || []).filter(video => urls.includes(video.url) && video.milestone_date === record.date && video.evidence_kind === "video");
    if (urls.length && videos.length === urls.length) archive.reviews[record.milestone_id] = { ...review, milestone_id: record.milestone_id, fingerprint: milestoneFingerprint(record) };
  }
}
let previous = structuredClone(dashboard);
if (state && ["running", "finalized"].includes(state.status)) {
  previous = JSON.parse(fs.readFileSync(path.join(state.directory, "public", "dashboard_data.json"), "utf8"));
  const oldGames = JSON.parse(fs.readFileSync(path.join(state.directory, "public", "games.json"), "utf8"));
  synchronizeIdentities(previous, oldGames);
}
if (arg("--baseline-ref")) {
  const baselineRef = arg("--baseline-ref");
  previous = JSON.parse(execFileSync("git", ["show", `${baselineRef}:public/dashboard_data.json`], { cwd: root, encoding: "utf8" }));
  const previousGames = JSON.parse(execFileSync("git", ["show", `${baselineRef}:public/games.json`], { cwd: root, encoding: "utf8" }));
  synchronizeIdentities(previous, previousGames);
}
if (arg("--reviews")) applyMediaReviews(dashboard, archive, JSON.parse(fs.readFileSync(path.resolve(arg("--reviews")), "utf8")), today);
for (const detail of Object.values(dashboard.pipelineDetails)) {
  for (const record of detail.testing?.records || []) {
    if (archive.reviews[record.milestone_id]) record.media_review = archive.reviews[record.milestone_id];
  }
}
write("dashboard_data.json", dashboard); write("games.json", games);
write("product-catalog.json", catalogue); write("media-reviews.json", archive);
const tasks = buildMediaQueue(dashboard, previous, archive, { all: command === "audit" || cadence === "monthly" });
const backlog = buildMediaQueue(dashboard, dashboard, archive, { all: true });
const errors = validateContent(dashboard, games, previous, archive, read("editorial-decisions.json", { decisions: [] }));
const discovery = read("youyansuo_discovery.json", {});
const editorialDecisions = read("editorial-decisions.json", { decisions: [] }).decisions;
for (const candidate of discovery.candidates || []) {
  const decisions = editorialDecisions.filter(decision => normalizeEntityName(decision.name) === normalizeEntityName(candidate.name));
  if (!decisions.some(decision => decision.action === "include_candidate" && decision.reason && decision.source)
    || decisions.some(decision => ["exclude", "exclude_candidate"].includes(decision.action))) {
    errors.push(`Unapproved discovery candidate: ${candidate.name}`);
  }
}
for (const filename of ["databrain_events.json", "databrain_research.json"]) {
  for (const [name, records] of Object.entries(read(filename, { games: {} }).games || {})) {
    for (const record of records) {
      const issue = recordEvidenceIssue(name, record, filename === "databrain_events.json" ? "event" : "research");
      if (issue) errors.push(`Invalid source evidence: ${name} ${record.title} (${issue})`);
    }
  }
}
const queuePath = path.join(root, "reports", "media-search-queue.json");
fs.mkdirSync(path.dirname(queuePath), { recursive: true });
fs.writeFileSync(queuePath, JSON.stringify({ run_id: state?.run_id || null, checked_at: today, tasks, historical_backlog: backlog }, null, 2));
if (command === "finalize") {
  if (!state || !["running", "finalized"].includes(state.status)) throw new Error("Begin a content run before finalizing");
  const oldReport = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {};
  const daily = cadence === "daily";
  const externalModules = arg("--modules") ? JSON.parse(fs.readFileSync(path.resolve(arg("--modules")), "utf8")) : {};
  const modules = { ...oldReport.modules, ...externalModules,
    identity: { required: !daily, status: errors.some(error => /identity|product|Excluded/.test(error)) ? "blocked" : "passed" },
    lifecycle: { required: !daily, status: errors.some(error => /historical milestone/.test(error)) ? "blocked" : "passed" },
    media: { required: !daily, status: tasks.some(task => task.required_for_release) ? "blocked" : "passed", pending_changes: tasks.filter(task => task.required_for_release).length, historical_backlog: backlog.length },
    views: { required: !daily, status: errors.some(error => /group|association|feeds|detail/.test(error)) ? "blocked" : "passed" },
    content: { required: true, status: errors.length ? "blocked" : "passed", errors },
    build: { required: true, status: "not_run" },
  };
  const requiredModules = { daily: ["metrics"], weekly: ["metrics", "steam", "intelligence", "events", "research", "editorial"], intelligence: ["intelligence", "editorial"], monthly: ["editorial", "historical_media"], manual: [] }[cadence];
  for (const name of requiredModules) modules[name] = { ...modules[name], required: true, status: modules[name]?.status || "not_run" };
  if (cadence === "monthly") modules.historical_media = { required: true, status: backlog.length ? "blocked" : "passed", pending: backlog.length };
  // Build verification is performed by the publisher after this finalizer.
  const contentStatus = runStatus(Object.fromEntries(Object.entries(modules).filter(([name]) => name !== "build")));
  const report = { ...oldReport, run_id: state.run_id, cadence, started_at: state.started_at, modules, status: contentStatus === "complete" ? "ready_for_build" : contentStatus, finalized_at: new Date().toISOString(), publication: publicationReport(null) };
  if (report.youyansuo && discovery.meta) Object.assign(report.youyansuo, { candidates: discovery.meta.candidates, tracked_updates: discovery.meta.tracked_updates, pending_candidates: discovery.meta.pending_candidates || 0 });
  if (contentStatus === "complete") { delete report.failed_phase; delete report.error; }
  write("content-health.json", { checked_at: today, scope: cadence, status: contentStatus, modules: Object.fromEntries(Object.entries(modules).filter(([name]) => name !== "build")), historical_media_backlog: backlog.length, historical_media_status: backlog.length ? "pending" : "passed",
    dates: { intelligence: read("youyansuo_discovery.json", {}).meta?.scan_date || null, metrics: read("databrain_latest_metrics.json", {}).meta?.query_range?.at(-1) || null, lifecycle: dashboard.pipelineMeta?.lifecycle_reviewed_at || null } });
  report.content_version = contentVersion(publicFiles(publicRoot));
  writeRefreshReport(reportPath, report);
  if (contentStatus !== "complete") { console.error(JSON.stringify({ status: contentStatus, errors, queue: queuePath })); process.exitCode = 1; }
  else { fs.rmSync(activePath, { recursive: true, force: true }); state.status = "finalized"; fs.writeFileSync(statePath, JSON.stringify(state)); }
} else if (errors.length && command !== "queue" && command !== "audit") { console.error(JSON.stringify({ errors, queue: queuePath })); process.exitCode = 1; }
console.log(JSON.stringify({ command, changed_nodes_pending: tasks.filter(task => task.required_for_release).length, historical_backlog: backlog.length, queue: queuePath }));

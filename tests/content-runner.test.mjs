import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
const source = path.resolve(import.meta.dirname, "..");
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "radar-content-run-"));
  fs.mkdirSync(path.join(root, "scripts")); fs.mkdirSync(path.join(root, "public"));
  for (const name of fs.readdirSync(path.join(source, "scripts"))) if (name.endsWith(".mjs")) fs.copyFileSync(path.join(source, "scripts", name), path.join(root, "scripts", name));
  for (const name of ["dashboard_data.json", "games.json", "editorial-decisions.json", "media-reviews.json", "databrain_latest_metrics.json"]) fs.copyFileSync(path.join(source, "public", name), path.join(root, "public", name));
  fs.writeFileSync(path.join(root, ".gitignore"), ".automation/\nreports/\n");
  const invoke = (script, ...args) => spawnSync(process.execPath, [path.join(root, "scripts", script), ...args], { cwd: root, encoding: "utf8", env: { ...process.env, DATABRAIN_TOKEN: "" } });
  const git = args => { const result = spawnSync("git", args, { cwd: root, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); };
  git(["init", "-q"]); git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "baseline"]);
  return { root, invoke, remove: () => fs.rmSync(root, { recursive: true, force: true }) };
}
test("CI baseline rejects a changed unrevised test and full abort restores extra files", () => {
  const s = sandbox();
  try {
    assert.equal(s.invoke("content-workflow.mjs", "begin", "--cadence=weekly").status, 0);
    const file = path.join(s.root, "public/dashboard_data.json"), original = fs.readFileSync(file, "utf8"), data = JSON.parse(original);
    const detail = Object.values(data.pipelineDetails).find(detail => detail.testing?.records?.length);
    detail.testing.records.push({ date: "2026-10-08", type: "测试", title: "新增验证测试", url: "https://example.com/test" });
    fs.writeFileSync(file, JSON.stringify(data)); fs.writeFileSync(path.join(s.root, "public/extra.json"), "{}");
    const result = s.invoke("content-workflow.mjs", "prepare", "--cadence=weekly", "--baseline-ref=HEAD");
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Unreviewed changed test/);
    assert.equal(s.invoke("content-workflow.mjs", "abort", "--cadence=weekly").status, 0);
    assert.equal(fs.readFileSync(file, "utf8"), original); assert.equal(fs.existsSync(path.join(s.root, "public/extra.json")), false);
  } finally { s.remove(); }
});
test("required source missing writes fresh failed report without touching public data", () => {
  const s = sandbox();
  try {
    const file = path.join(s.root, "public/dashboard_data.json"), original = fs.readFileSync(file, "utf8");
    for (const cadence of ["daily", "weekly"]) {
      const result = s.invoke(`${cadence}-refresh.mjs`); assert.notEqual(result.status, 0); assert.match(result.stderr, /DATABRAIN_TOKEN/);
      const report = JSON.parse(fs.readFileSync(path.join(s.root, `reports/${cadence}-refresh-latest.json`)));
      assert.equal(report.status, "failed"); assert.equal(report.modules.preflight.status, "failed"); assert.ok(report.started_at);
      assert.equal(fs.readFileSync(file, "utf8"), original);
    }
  } finally { s.remove(); }
});
test("a missing weekly discovery input can never pass finalize", () => {
  const s = sandbox();
  try {
    assert.equal(s.invoke("content-workflow.mjs", "begin", "--cadence=weekly").status, 0);
    const result = s.invoke("content-workflow.mjs", "finalize", "--cadence=weekly"); assert.notEqual(result.status, 0);
    const report = JSON.parse(fs.readFileSync(path.join(s.root, "reports/weekly-refresh-latest.json")));
    assert.equal(report.status, "degraded"); assert.equal(report.modules.intelligence.status, "not_run"); assert.equal(report.publication.status, "not_started");
    assert.notEqual(s.invoke("content-workflow.mjs", "begin", "--cadence=monthly").status, 0);
  } finally { s.remove(); }
});
test("content versions stay stable on rebuild and change automatically with data", () => {
  const s = sandbox();
  try {
    assert.equal(s.invoke("prepare-release.mjs").status, 0);
    const file = path.join(s.root, "public/release-manifest.json"), original = fs.readFileSync(file, "utf8");
    assert.equal(s.invoke("prepare-release.mjs").status, 0); assert.equal(fs.readFileSync(file, "utf8"), original);
    fs.writeFileSync(path.join(s.root, "public/new.json"), '{"changed":true}');
    assert.equal(s.invoke("prepare-release.mjs").status, 0); assert.notEqual(JSON.parse(fs.readFileSync(file)).version, JSON.parse(original).version);
  } finally { s.remove(); }
});

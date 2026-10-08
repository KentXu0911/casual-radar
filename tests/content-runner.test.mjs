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

test("DataBrain collectors reject denied or empty responses instead of claiming coverage", () => {
  const s = sandbox();
  try {
    const mock = path.join(s.root, "mock-fetch.mjs");
    const invoke = (script, mode) => {
      const response = mode === "denied"
        ? 'globalThis.fetch = async () => new Response("denied", { status: 403 });'
        : 'globalThis.fetch = async () => new Response(\'data: {"result":{"artifact":{"parts":[]}}}\\n\\n\', { status: 200 });';
      fs.writeFileSync(mock, response + '\nconst mockFetch = globalThis.fetch; globalThis.fetch = async (url, options) => { const fs = await import("node:fs"); fs.writeFileSync("request.json", options.body); return mockFetch(); };');
      return spawnSync(process.execPath, ["--import", mock, path.join(s.root, "scripts", script), "--games=糖豆人", "--batch-size=1", `--output-root=${path.join(s.root, "outputs")}`], {
        cwd: s.root, encoding: "utf8", env: { ...process.env, DATABRAIN_TOKEN: "test-token" },
      });
    };
    for (const mode of ["denied", "empty"]) {
      const events = invoke("fetch-databrain-events.mjs", mode);
      assert.notEqual(events.status, 0, events.stdout);
      const bundle = JSON.parse(fs.readFileSync(path.join(s.root, "public/databrain_events.json")));
      assert.equal(bundle.meta.failed_batches.length, 1);
      assert.deepEqual(bundle.meta.completed_batches, []);
      const metrics = invoke("fetch-databrain-trends.mjs", mode);
      assert.notEqual(metrics.status, 0, metrics.stdout);
      const manifest = JSON.parse(fs.readFileSync(path.join(s.root, "outputs/databrain_latest_90d_manifest.json")));
      assert.equal(manifest.batches[0].status, "failed");
      const request = JSON.parse(fs.readFileSync(path.join(s.root, "request.json")));
      assert.ok(Math.abs(Date.now() - Date.parse(request.params.metadata.date_time)) < 60000, "DataBrain receives actual execution time");
    }
    const raw = fs.readdirSync(path.join(s.root, ".automation/databrain-events"));
    assert.equal(raw.length, 2, "Both empty-response attempts are retained for diagnosis");
  } finally { s.remove(); }
});

test("partial metric returns distinguish refreshed, retained and unavailable products", () => {
  const s = sandbox();
  try {
    const outputs = path.join(s.root, "outputs"); fs.mkdirSync(outputs);
    fs.writeFileSync(path.join(s.root, "public/databrain_latest_metrics.json"), JSON.stringify({ meta: {}, mobile_games: { "蛋仔派对": { date: "2026-09-30", dau: 123 } }, pc_games: {} }));
    const manifest = { query_range: ["2026-10-01", "2026-10-07"], batches: [{ status: "complete", file: "batch.json", games: ["糖豆人", "蛋仔派对", "Project63"].map(canonical => ({ canonical })) }] };
    fs.writeFileSync(path.join(outputs, "databrain_latest_90d_manifest.json"), JSON.stringify(manifest));
    fs.writeFileSync(path.join(outputs, "batch.json"), JSON.stringify({ sessionId: "test-session", system_url: "https://example.com/session", events: [{ result: { artifact: { parts: [{ type: "data", data: { type: "bi_data", value: [{ data: { data: [{ game_name: "糖豆人", game_type: "mobile", granularity: "daily", metric: "dau", date: "2026-10-07", value: 456, platform: "all", source: "test" }] } }] } }] } } }] }));
    const result = s.invoke("build-latest-databrain.mjs", "--merge", `--output-root=${outputs}`, `--bi-root=${path.join(s.root, "bi_data")}`);
    assert.equal(result.status, 0, result.stderr);
    const metrics = JSON.parse(fs.readFileSync(path.join(s.root, "public/databrain_latest_metrics.json")));
    assert.deepEqual(metrics.meta.refresh_coverage.returned_metric_games, ["糖豆人"]);
    assert.deepEqual(metrics.meta.refresh_coverage.retained_previous_games, ["蛋仔派对"]);
    assert.deepEqual(metrics.meta.refresh_coverage.no_metric_returned_games, ["Project63"]);
    assert.equal(metrics.mobile_games["蛋仔派对"].date, "2026-09-30");
  } finally { s.remove(); }
});

test("publication preparation blocks fabricated event citations even outside pipeline details", () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.root, "public/databrain_events.json"), JSON.stringify({ games: { "裂隙远征": [{ title: "Demo launch", url: "https://store.steampowered.com/app/XXXXXXXXX/Demo/", source: "Steam" }] } }));
    const result = s.invoke("content-workflow.mjs", "prepare");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid source evidence/);
  } finally { s.remove(); }
});

test("publication gate rejects a discovery candidate without an editorial admission decision", () => {
  const s = sandbox();
  try {
    fs.writeFileSync(path.join(s.root, "public/youyansuo_discovery.json"), JSON.stringify({ candidates: [{ name: "未经确认的新游戏" }] }));
    const result = s.invoke("content-workflow.mjs", "prepare");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unapproved discovery candidate/);
  } finally { s.remove(); }
});

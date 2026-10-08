import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { verifyWorkflowRun, verifyPublication } from "../scripts/publication-verifier.mjs";
const sha = "a".repeat(40), version = "test-version", runId = "123";
const run = { id: 123, head_sha: sha, head_branch: "main", path: ".github/workflows/pages.yml", status: "completed", conclusion: "success" };
function mockLive({ wrongSha = false, corrupt = false } = {}) {
  const data = { "dashboard_data.json": "{}", "games.json": '{"games":[]}' };
  const manifest = { source_commit: wrongSha ? "b".repeat(40) : sha, version, files: Object.fromEntries(Object.entries(data).map(([name, value]) => [name, createHash("sha256").update(value).digest("hex")])) };
  return async url => {
    const name = new URL(url).pathname.replace("/casual-radar/", "");
    return new Response(name === "release-manifest.json" ? JSON.stringify(manifest) : name === "" ? '<html><script src="assets/app.js"></script></html>' : name === "assets/app.js" ? `console.log("${version}")` : corrupt ? "corrupted" : data[name], { status: 200 });
  };
}
test("publication rejects unrelated commit, wrong workflow and failed deployment", () => {
  for (const patch of [{ head_sha: "b".repeat(40) }, { path: ".github/workflows/other.yml" }, { conclusion: "failure" }, { status: "in_progress" }, { id: 124 }]) assert.throws(() => verifyWorkflowRun({ ...run, ...patch }, sha, runId));
});
test("successful Actions alone cannot certify stale or corrupt online data", async () => {
  for (const config of [{ wrongSha: true }, { corrupt: true }]) await assert.rejects(verifyPublication({ sha, runId, version, url: "https://kentxu0911.github.io/casual-radar/", getRun: async () => run, request: mockLive(config) }), /manifest|mismatch/);
});
test("successful receipt requires exact commit plus all live JSON hashes", async () => {
  const receipt = await verifyPublication({ sha, runId, version, url: "https://kentxu0911.github.io/casual-radar/", getRun: async () => run, request: mockLive() });
  assert.equal(receipt.health_check, "exact_commit_and_live_hashes_passed"); assert.equal(receipt.verified_data_files, 2); assert.equal(receipt.commit_sha, sha);
});

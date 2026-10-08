import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { publicationReport } from "../scripts/refresh-runner-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("GitHub publication needs a complete refresh and identifiable deployment", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pages-publication-"));
  try {
    const report = path.join(directory, "weekly-refresh-latest.json");
    const invoke = (args) => spawnSync(process.execPath, ["scripts/record-publication.mjs", `--report=${report}`, "--provider=github_pages", "--url=https://kentxu0911.github.io/casual-radar/", ...args], { cwd: root, encoding: "utf8" });
    const sha = "a".repeat(40);
    fs.writeFileSync(report, JSON.stringify({ status: "failed", publication: publicationReport(null) }));
    assert.notEqual(invoke([`--commit-sha=${sha}`, "--run-id=123"]).status, 0);
    fs.writeFileSync(report, JSON.stringify({ status: "complete", publication: publicationReport(null) }));
    assert.notEqual(invoke([]).status, 0);
    assert.equal(invoke([`--commit-sha=${sha}`, "--run-id=123"]).status, 0);
    const publication = JSON.parse(fs.readFileSync(report, "utf8")).publication;
    assert.equal(publication.provider, "github_pages");
    assert.equal(publication.commit_sha, sha);
    assert.equal(publication.workflow_run_id, "123");
    assert.equal(publication.health_check, "github_actions_succeeded");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

import { execFileSync } from "node:child_process";
import { verifyPublication } from "./publication-verifier.mjs";
const repository = "KentXu0911/casual-radar";
const runs = JSON.parse(execFileSync("gh", ["api", `repos/${repository}/actions/workflows/pages.yml/runs?status=success&per_page=20`], { encoding: "utf8" })).workflow_runs;
const run = runs.filter(item => item.head_branch === "main").sort((a, b) => b.id - a.id)[0];
if (!run) throw new Error("No successful Pages deployment found");
const encoded = execFileSync("gh", ["api", `repos/${repository}/contents/public/release-manifest.json?ref=${run.head_sha}`, "--jq", ".content"], { encoding: "utf8" });
const manifest = JSON.parse(Buffer.from(encoded, "base64").toString());
console.log(JSON.stringify(await verifyPublication({ sha: run.head_sha, runId: run.id, url: "https://kentxu0911.github.io/casual-radar/", version: manifest.version })));

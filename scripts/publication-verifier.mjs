import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export function verifyWorkflowRun(run, sha, runId) {
  if (String(run.id) !== String(runId) || run.head_sha !== sha || run.path !== ".github/workflows/pages.yml" || run.head_branch !== "main" || run.status !== "completed" || run.conclusion !== "success") {
    throw new Error("Pages workflow is not a successful deployment of the requested commit");
  }
}
export function validateManifest(manifest, sha, expectedVersion) {
  if (manifest.source_commit !== sha || manifest.version !== expectedVersion || !Object.keys(manifest.files || {}).length) throw new Error("Live release manifest does not match the requested commit/content");
  for (const [name, hash] of Object.entries(manifest.files)) {
    if (name.startsWith("/") || name.split("/").some(part => ["..", ".", ""].includes(part)) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid public manifest entry");
  }
}
export async function verifyPublication({ sha, runId, url, version, request = fetch, getRun = id => JSON.parse(execFileSync("gh", ["api", `repos/KentXu0911/casual-radar/actions/runs/${id}`], { encoding: "utf8" })) }) {
  if (!/^[a-f0-9]{40}$/.test(sha || "") || !/^\d+$/.test(String(runId || ""))) throw new Error("Full commit SHA and workflow run ID are required");
  if (url !== "https://kentxu0911.github.io/casual-radar/") throw new Error("Unexpected publication URL");
  verifyWorkflowRun(await getRun(runId), sha, runId);
  const read = async name => {
    const response = await request(`${url}${name}?release=${sha}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Live file unavailable: ${name} (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  };
  const manifest = JSON.parse((await read("release-manifest.json")).toString());
  validateManifest(manifest, sha, version);
  // Verify every published data file and the loaded application, without downloading media.
  const names = Object.keys(manifest.files).filter(name => /\.json$/.test(name));
  if (!names.includes("dashboard_data.json") || !names.includes("games.json")) throw new Error("Required live datasets are missing from manifest");
  for (let offset = 0; offset < names.length; offset += 6) {
    await Promise.all(names.slice(offset, offset + 6).map(async name => {
      const actual = createHash("sha256").update(await read(name)).digest("hex");
      if (actual !== manifest.files[name]) throw new Error(`Live content mismatch: ${name}`);
    }));
  }
  const index = (await read("")).toString();
  if (!index.includes("<html") || !index.includes("assets/")) throw new Error("Live dashboard application is unavailable");
  const scripts = [...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  let appVersionFound = false;
  for (const script of scripts) {
    const asset = new URL(script, url);
    if (asset.origin !== new URL(url).origin || !asset.pathname.startsWith("/casual-radar/")) throw new Error("Unexpected application asset");
    if ((await read(asset.pathname.slice("/casual-radar/".length))).toString().includes(version)) appVersionFound = true;
  }
  if (!appVersionFound) throw new Error("Live application does not contain the requested data version");
  return { provider: "github_pages", status: "succeeded", repository: "KentXu0911/casual-radar", commit_sha: sha, workflow_run_id: String(runId), workflow_run_url: `https://github.com/KentXu0911/casual-radar/actions/runs/${runId}`, url, content_version: manifest.version, checked_at: new Date().toISOString(), health_check: "exact_commit_and_live_hashes_passed", verified_data_files: names.length };
}

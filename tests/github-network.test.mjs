import test from "node:test";
import assert from "node:assert/strict";
import { githubNetwork } from "../scripts/github-network-lib.mjs";
import { publishedToday } from "../scripts/automation-preflight.mjs";

test("a broken configured proxy falls back to direct Git without changing parent environment", async () => {
  const env = { HTTPS_PROXY: "http://127.0.0.1:7897", all_proxy: "socks5://127.0.0.1:7897" };
  const calls = [];
  const result = await githubNetwork("git", ["ls-remote", "origin"], { env, sleep: async () => {}, log: () => {}, executor: async (command, args, options) => {
    calls.push({ command, args, options });
    if (calls.length === 1) throw new Error("LibreSSL SSL_connect: SSL_ERROR_SYSCALL");
    assert.equal(options.env.HTTPS_PROXY, undefined);
    assert.equal(options.env.all_proxy, undefined);
    assert.ok(args.includes("http.proxy="));
    return { stdout: "remote head" };
  } });
  assert.equal(result, "remote head"); assert.equal(calls.length, 2);
  assert.equal(env.HTTPS_PROXY, "http://127.0.0.1:7897");
});
test("authentication and fast-forward failures stop immediately", async () => {
  for (const message of ["Authentication failed", "Not possible to fast-forward", "non-fast-forward", "HTTP 403"]) {
    let calls = 0;
    await assert.rejects(githubNetwork("git", ["push"], { log: () => {}, executor: async () => { calls++; throw new Error(message); } }), new RegExp(message));
    assert.equal(calls, 1);
  }
});
test("transient failures exhaust bounded retries including HTTP/1.1 fallback", async () => {
  const calls = [], waits = [];
  await assert.rejects(githubNetwork("git", ["pull"], { log: () => {}, sleep: async ms => waits.push(ms), executor: async (_, args) => { calls.push(args); throw new Error("SSL_ERROR_SYSCALL"); } }), /SSL_ERROR_SYSCALL/);
  assert.equal(calls.length, 4); assert.deepEqual(waits, [2000, 5000, 10000]);
  assert.ok(calls[2].includes("http.version=HTTP/1.1"));
});
test("only an exactly verified batch collected and published today can skip a scheduled retry", () => {
  const now = new Date("2026-10-12T02:00:00Z");
  const report = { status: "complete", started_at: "2026-10-11T23:00:00Z", publication: { status: "succeeded", checked_at: "2026-10-12T01:00:00Z", health_check: "exact_commit_and_live_hashes_passed" } };
  assert.equal(publishedToday(report, now), true);
  assert.equal(publishedToday({ ...report, started_at: "2026-10-11T01:00:00Z" }, now), false);
  assert.equal(publishedToday({ ...report, publication: { ...report.publication, status: "failed" } }, now), false);
  assert.equal(publishedToday({ ...report, status: "ready_for_build" }, now), false);
});

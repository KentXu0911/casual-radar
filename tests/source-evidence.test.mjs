import test from "node:test";
import assert from "node:assert/strict";
import { resolveEvidenceRows, recordEvidenceIssue } from "../scripts/source-evidence-lib.mjs";

test("source resolution keeps original citations and quarantines unavailable redirects", async () => {
  const prefix = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";
  const rows = [{ url: prefix + "valid", source: "Official", title: "Announcement" }, { url: prefix + "missing", source: "Official", title: "Missing" }];
  const resolved = await resolveEvidenceRows(rows, { fetcher: async url => ({ ok: url.endsWith("valid"), url: "https://mo.co/en/news/news/moco-goes-back-to-beta-2/", body: { cancel: async () => {} } }) });
  assert.equal(resolved[0].original_url, rows[0].url);
  assert.equal(recordEvidenceIssue("mo.co", resolved[0], "event"), "");
  assert.ok(recordEvidenceIssue("mo.co", resolved[1], "event"));
  assert.ok(recordEvidenceIssue("mo.co", rows[0], "event"), "Raw redirect URLs cannot bypass publication gate");
});

test("a product homepage cannot alone substantiate a new dated test event", () => {
  const row = { url: "https://life.qq.com/", title: "Test qualification distribution", source: "Official" };
  assert.equal(recordEvidenceIssue("粒粒的小人国", row, "event"), "homepage_does_not_prove_event_date");
  assert.equal(recordEvidenceIssue("粒粒的小人国", row, "research"), "");
});

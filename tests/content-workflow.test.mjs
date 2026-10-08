import test from "node:test";
import assert from "node:assert/strict";
import { day, synchronizeIdentities, milestoneFingerprint, mergeVerifiedDetail, buildMediaQueue, applyMediaReviews, validateContent, runStatus } from "../scripts/content-workflow-lib.mjs";
import { synchronizeDiscoveredStudioProducts } from "../scripts/studio-association-lib.mjs";
function fixture() {
  const games = { games: [{ name: "演示", aliases: ["Demo", "旧代号"], category: "模拟经营", lifecycle: { pipeline: true } }] };
  const dashboard = { games: structuredClone(games.games), pipelineGroups: [{ name: "其他厂商在研新品", projects: ["演示"] }], domesticStudios: [{ name: "厂商", known_pipeline: [] }], overseasStudios: {}, pipelineDetails: { "演示": { category: "模拟经营", analysis: { core_loop: "种植收获经营" }, team: { company: "厂商", sources: [{ url: "https://example.com/studio" }] }, testing: { records: [{ date: "2026-10-08", type: "首曝", title: "首次公开", url: "https://example.com/reveal" }] }, gameplay_videos: [] } } };
  synchronizeIdentities(dashboard, games);
  synchronizeDiscoveredStudioProducts(dashboard, games);
  return { dashboard, games, archive: { reviews: {} }, previous: { pipelineDetails: {} } };
}
function review(f, status = "matched") {
  const node = f.dashboard.pipelineDetails["演示"].testing.records[0];
  return { milestone_id: node.milestone_id, fingerprint: milestoneFingerprint(node), status, checked_at: "2026-10-08", scope: "首曝PV", videos: [{ url: "https://example.com/video", title: "首曝PV", date: "2026-10-07", type: "PV", scope: "首曝", source: "官方", evidence_kind: "video" }] };
}
test("new reveal requires footage search and verified footage links to its exact event", () => {
  const f = fixture();
  const queue = buildMediaQueue(f.dashboard, f.previous, f.archive);
  assert.equal(queue.length, 1); assert.equal(queue[0].required_for_release, true);
  assert.ok(queue[0].queries.some(query => query.startsWith("旧代号")));
  assert.match(validateContent(f.dashboard, f.games, f.previous, f.archive).join(), /Unreviewed/);
  applyMediaReviews(f.dashboard, f.archive, { reviews: [review(f)] }, "2026-10-08");
  assert.deepEqual(validateContent(f.dashboard, f.games, f.previous, f.archive), []);
  const detail = f.dashboard.pipelineDetails["演示"];
  assert.equal(detail.gameplay_videos[0].milestone_id, detail.testing.records[0].milestone_id);
  assert.equal(detail.gameplay_videos[0].date, "2026-10-07");
  assert.equal(detail.gameplay_videos[0].milestone_date, "2026-10-08");
  assert.ok(f.dashboard.domesticStudios[0].known_pipeline.includes("演示"));
});
test("no-match needs successful actual search logs; blocked search stays pending", () => {
  const f = fixture(), r = review(f, "searched_no_match"); delete r.videos;
  assert.throws(() => applyMediaReviews(f.dashboard, f.archive, { reviews: [r] }, "2026-10-08"), /Incomplete/);
  r.searches = [{ query: "演示 首曝 PV", platform: "Bilibili", status: "success" }]; r.reason = "核查无本产品结果";
  applyMediaReviews(f.dashboard, f.archive, { reviews: [r] }, "2026-10-08");
  assert.equal(buildMediaQueue(f.dashboard, f.previous, f.archive).length, 0);
  r.status = "blocked"; r.searches[0].status = "failed";
  applyMediaReviews(f.dashboard, f.archive, { reviews: [r] }, "2026-10-08");
  assert.equal(buildMediaQueue(f.dashboard, f.previous, f.archive).length, 1);
});
test("stale review, unsupported matched URLs and footage from a different round are rejected", () => {
  const f = fixture(), r = review(f);
  assert.throws(() => applyMediaReviews(f.dashboard, f.archive, { reviews: [{ ...r, fingerprint: "old" }] }, "2026-10-08"), /Stale/);
  assert.throws(() => applyMediaReviews(f.dashboard, f.archive, { reviews: [{ ...r, videos: [], urls: ["https://example.com/unverified"] }] }, "2026-10-08"), /Unverified/);
  r.videos[0].milestone_date = "2026-09-08";
  assert.throws(() => applyMediaReviews(f.dashboard, f.archive, { reviews: [r] }, "2026-10-08"), /Wrong footage round/);
});
test("changed dates invalidate review without changing an established node identity", () => {
  const f = fixture(); applyMediaReviews(f.dashboard, f.archive, { reviews: [review(f)] }, "2026-10-08");
  const previous = structuredClone(f.dashboard), node = f.dashboard.pipelineDetails["演示"].testing.records[0], id = node.milestone_id;
  node.date = "2026-10-09"; synchronizeIdentities(f.dashboard, f.games);
  assert.equal(node.milestone_id, id); assert.equal(buildMediaQueue(f.dashboard, previous, f.archive).length, 1);
});
test("historical backlog is distinct from mandatory changed nodes and deletion needs an editorial decision", () => {
  const f = fixture(), previous = structuredClone(f.dashboard);
  assert.equal(buildMediaQueue(f.dashboard, previous, f.archive).length, 0);
  assert.equal(buildMediaQueue(f.dashboard, previous, f.archive, { all: true })[0].required_for_release, false);
  f.dashboard.pipelineDetails["演示"].testing.records = [];
  assert.match(validateContent(f.dashboard, f.games, previous, f.archive).join(), /Lost historical milestone/);
});
test("generated detail cannot overwrite curated fields or remove historic footage", () => {
  const merged = mergeVerifiedDetail({ stage: "三测", gameplay_videos: [{ url: "a", title: "核验" }], testing: { records: [{ date: "2026-10-08", type: "测试", title: "三测" }] } }, { stage: "首曝", gameplay_videos: [{ url: "a", title: "旧快照" }, { url: "b" }], testing: { records: [{ date: "2026-01-01", type: "首曝", title: "首曝" }] } });
  assert.equal(merged.stage, "三测"); assert.equal(merged.gameplay_videos[0].title, "核验"); assert.equal(merged.testing.records.length, 2);
});
test("repeat rounds receive distinct initial IDs; identity is idempotent", () => {
  const f = fixture(), records = f.dashboard.pipelineDetails["演示"].testing.records;
  records.push({ ...records[0], milestone_id: undefined, date: "2026-10-09" });
  synchronizeIdentities(f.dashboard, f.games);
  assert.notEqual(records[0].milestone_id, records[1].milestone_id);
  const old = JSON.stringify(f.dashboard); synchronizeIdentities(f.dashboard, f.games); assert.equal(JSON.stringify(f.dashboard), old);
});
test("invalid calendar dates and required skipped sources cannot pass", () => {
  assert.equal(day("2026-02-30"), ""); assert.equal(day("2024-02-29"), "2024-02-29");
  assert.equal(runStatus({ source: { required: true, status: "skipped" } }), "degraded");
  assert.equal(runStatus({ source: { required: true, status: "failed" } }), "failed");
  assert.equal(runStatus({ source: { required: true, status: "no_change" } }), "complete");
});
test("snapshot without event IDs merges into curated records without duplication", () => {
  const old = { date: "2026-10-08", type: "测试", title: "三测", milestone_id: "stable", media_review: { status: "matched" } };
  const merged = mergeVerifiedDetail({ testing: { records: [old] } }, { testing: { records: [{ date: old.date, type: old.type, title: old.title }] } });
  assert.equal(merged.testing.records.length, 1); assert.equal(merged.testing.records[0].milestone_id, "stable");
});

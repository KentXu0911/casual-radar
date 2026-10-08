import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMetricSeries } from "../app/metric-anomalies.ts";

const asOf = "2026-09-07";
function series(values = Array(35).fill(100)) {
  return { source: "test source", session_url: "https://example.com/evidence", activity: {
    label: "DAU", granularity: "daily", scope: "移动端全球",
    points: values.map((value, i) => ({ date: new Date(Date.UTC(2026, 7, 4 + i)).toISOString().slice(0, 10), value })),
  } };
}
const evaluate = input => evaluateMetricSeries(input, "activity", asOf);
test("PC ACU retains its metric and participates in both directions", () => {
  for (const value of [150, 50]) {
    const input = series([...Array(28).fill(100), ...Array(7).fill(value)]);
    input.activity.label = "PC 日均 ACU";
    input.activity.scope = "PC / Steam 全球";
    const { signal } = evaluateMetricSeries(input, "activity", asOf, "PC");
    assert.equal(signal.metric, "ACU");
    assert.equal(signal.triggered, true);
    assert.equal(signal.change, (value - 100) / 100);
    assert.ok(evaluateMetricSeries(input, "activity", asOf, "移动").reason);
    input.activity.label = "CCU";
    assert.ok(evaluate(input).reason);
  }
});
test("ordinary and repeatable weekend variation stays quiet", () => {
  assert.equal(evaluate(series()).signal.triggered, false);
  assert.equal(evaluate(series(Array.from({ length: 35 }, (_, i) => i % 7 >= 5 ? 180 : 100))).signal.triggered, false);
});
test("sustained growth and decline trigger with real comparison windows", () => {
  for (const value of [150, 50]) {
    const { signal } = evaluate(series([...Array(28).fill(100), ...Array(7).fill(value)]));
    assert.equal(signal.triggered, true);
    assert.equal(signal.change, (value - 100) / 100);
    assert.equal(signal.start, "2026-09-01");
    assert.equal(signal.baselineEnd, "2026-08-31");
  }
});
test("large historical week-to-week volatility raises the threshold", () => {
  const { signal } = evaluate(series([50, 150, 50, 150, 150].flatMap(v => Array(7).fill(v))));
  assert.equal(signal.triggered, false);
  assert.ok(signal.threshold > 0.5);
});
test("one-day spike is not presented as sustained movement", () => {
  assert.equal(evaluate(series([...Array(34).fill(100), 1000])).signal.triggered, false);
});
test("missing days, short history, duplicate dates and zero bases remain unknown", () => {
  const missing = series(); missing.activity.points.splice(16, 1);
  const duplicate = series(); duplicate.activity.points.push(duplicate.activity.points[0]);
  for (const input of [missing, duplicate, series(Array(34).fill(100)), series(Array(35).fill(0))]) {
    assert.ok(evaluate(input).reason);
    assert.equal(evaluate(input).signal, undefined);
  }
});
test("stale data expires and future observations do not cause alerts", () => {
  assert.match(evaluateMetricSeries(series(), "activity", "2026-09-15").reason, /超过/);
  const future = series(); future.activity.points.push({ date: "2026-09-08", value: 100000 });
  assert.equal(evaluate(future).signal.triggered, false);
  assert.equal(evaluate(future).signal.end, asOf);
});
test("unsupported metrics and missing provenance are not relabeled as DAU or daily revenue", () => {
  const acu = series(); acu.activity.label = "PC 日均 ACU";
  const monthly = series(); monthly.activity.granularity = "monthly";
  const unverified = series(); delete unverified.source;
  for (const input of [acu, monthly, unverified]) assert.ok(evaluate(input).reason);
  const cumulative = { ...series(), revenue: { ...series().activity, label: "累计日收入", currency: "USD" } };
  assert.ok(evaluateMetricSeries(cumulative, "revenue", asOf).reason);
});
test("daily revenue retains its currency and platform scope", () => {
  const input = series([...Array(28).fill(100), ...Array(7).fill(160)]);
  input.revenue = { ...input.activity, label: "PC 日收入", scope: "PC / Steam 全球", currency: "USD" };
  const { signal } = evaluateMetricSeries(input, "revenue", asOf);
  assert.equal(signal.triggered, true);
  assert.equal(signal.currency, "USD");
  assert.equal(signal.scope, "PC / Steam 全球");
});
test("invalid or missing observations do not become zero and unsorted inputs are chronological", () => {
  const reversed = series(); reversed.activity.points.reverse();
  assert.equal(evaluate(reversed).signal.end, asOf);
  for (const value of [null, NaN, -1, "100"]) {
    const invalid = series(); invalid.activity.points[10].value = value;
    assert.ok(evaluate(invalid).reason);
  }
});
test("platform mismatch and pre-launch baselines cannot produce attention signals", () => {
  const input = series([...Array(28).fill(100), ...Array(7).fill(160)]);
  assert.match(evaluateMetricSeries(input, "activity", asOf, "PC").reason, /平台/);
  assert.equal(evaluateMetricSeries(input, "activity", asOf, "移动 / PC").signal.triggered, true);
  assert.match(evaluateMetricSeries(input, "activity", asOf, "移动", "2026-08-20").reason, /上线历史/);
});

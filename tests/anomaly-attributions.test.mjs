import test from 'node:test';
import assert from 'node:assert/strict';
import { anomalyAttribution } from '../app/anomaly-attributions.ts';
import generatedAttributions from '../public/anomaly-attributions.json' with { type: 'json' };
import trends from '../public/databrain_trends_90d.json' with { type: 'json' };
import games from '../public/games.json' with { type: 'json' };
import { evaluateMetricSeries } from '../app/metric-anomalies.ts';

const signal = { start: '2026-09-03', end: '2026-09-09', scope: 'PC / Steam 全球', change: 2.248, metric: 'ACU' };
test('current observations have dated evidence and distinguish unresolved attribution', () => {
  for (const name of ['First Class Trouble', 'Smalland', '创世理想乡']) {
    const result = anomalyAttribution(name, [signal]);
    assert.equal(result.status, 'hypothesis');
    assert.equal(result.reviewedAt, '2026-09-14');
    assert(result.sources.length);
  }
  for (const name of ['Jackbox派对包', '七龙珠：破界斗士']) {
    assert.equal(anomalyAttribution(name, [signal]).status, 'inconclusive');
  }
});
test('a previous explanation cannot carry into another week, platform or direction', () => {
  for (const override of [{ start: '2026-09-04', end: '2026-09-10' }, { change: -0.6 }, { scope: '移动端全球' }]) {
    assert.equal(anomalyAttribution('First Class Trouble', [{ ...signal, ...override }]), undefined);
  }
  assert.equal(anomalyAttribution('未知游戏', [signal]), undefined);
  assert.equal(anomalyAttribution('First Class Trouble', []), undefined);
  assert.equal(anomalyAttribution('First Class Trouble', [signal, { ...signal, end: '2026-09-10' }]), undefined);
});

test('current alert windows always have a reviewed attribution result', () => {
  const asOf = trends.meta.query_range.at(-1);
  assert.equal(generatedAttributions.meta.as_of, asOf);
  let alerts = 0;
  for (const [name, trend] of Object.entries(trends.games)) {
    const game = games.games.find(item => item.name === name) || { name };
    const platform = String(game.platform || (Array.isArray(game.platforms) ? game.platforms.join(' / ') : game.platforms) || game.metrics?.platform || '');
    const signals = ['activity', 'revenue'].flatMap(kind => {
      const result = evaluateMetricSeries(trend, kind, asOf, platform, game.release_date);
      return result.signal?.triggered ? [result.signal] : [];
    });
    if (!signals.length) continue;
    alerts += 1;
    const attribution = anomalyAttribution(name, signals);
    assert.ok(attribution, `${name} should have current-window attribution`);
    assert.equal(attribution.reviewedAt, generatedAttributions.meta.reviewed_at);
    assert.ok(attribution.sources.length);
    assert.doesNotMatch(attribution.summary, /尚未核查/);
  }
  assert.equal(alerts, generatedAttributions.meta.alerts);
  assert.equal(generatedAttributions.meta.covered_alerts, alerts);
  assert.equal(generatedAttributions.meta.uncovered_alerts, 0);
});

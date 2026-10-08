import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../public/${name}.json`, import.meta.url)));
test('new games retain sourced research across both merged data layers', () => {
  for (const name of ['games', 'dashboard_data']) {
    const fish = read(name).games.find(g => g.name === 'How to Fish');
    assert(fish.intelligence.recent_articles.some(a => a.url.endsWith('id=174') && /373,971/.test(a.summary)));
    assert(!fish.traits.includes('复玩性强'));
  }
  const metric = read('pc-metrics').games['How to Fish'];
  assert.equal(metric.average_ccu, 113308.33);
  assert.equal(metric.peak_ccu, 373887);
  assert.equal(metric.data_date, '2026-09-07');
  assert.equal(metric.revenue_30d, null);
  assert.equal(metric.source_url, 'https://steamcharts.com/app/4001890');
  const profile = read('development-profiles')['How to Fish'];
  assert.match(profile.early_team_size, /2 人/);
  assert.match(profile.prior_experience, /Out of Hand/);
  assert(profile.sources.some(s => s.url.startsWith('https://store.steampowered.com/')));
  const berry = read('dashboard_data').pipelineDetails['集合！浆果镇'];
  assert.match(berry.analysis.core_loop, /9种/);
  assert.match(berry.analysis.readiness, /未实装商业化/);
});

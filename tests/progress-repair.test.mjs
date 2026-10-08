import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, root)));
function mediaBuilder() {
  const page = fs.readFileSync(new URL('app/page.tsx', root), 'utf8');
  const source = page.slice(page.indexOf('function lifecyclePhase('), page.indexOf('function ProjectProgressMedia('));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('recordText', 'dateKey', 'shortDate', 'readableHeadline', 'timelineStatus', 'evidenceKind', js + '; return buildProgressMediaNodes;')(
    (item, key) => typeof item[key] === 'string' ? item[key] : '',
    value => typeof value === 'string' ? value.slice(0, 10) : '',
    value => value.replaceAll('-', '.'), value => value, item => item.status || 'confirmed', () => 'video'
  );
}
test('new test footage links to its verified round without changing the test date', () => {
  const build = mediaBuilder();
  const details = read('public/dashboard_data.json').pipelineDetails;
  for (const [name, date] of [['粒粒的小人国', '2026-09-22'], ['星布谷地', '2026-09-20'], ['蓝色星原：旅谣', '2026-09-17'], ['未眠野', '2026-09-24']]) {
    const item = details[name];
    const result = build(item.testing.records, item.gameplay_videos);
    const node = result.nodes.find(x => x.dateKeys.includes(date));
    assert.ok(node, name);
    const matching = item.gameplay_videos.filter(x => x.milestone_date === date);
    assert.ok(matching.length > 0, name);
    assert.ok(matching.every(x => node.evidence.some(e => e.url === x.url)), name);
    assert.equal(item.testing.records.find(x => x.date === date).media_review.status, 'matched');
  }
  for (const name of ['Project63', 'Dear Passengers']) {
    const item = details[name];
    const result = build(item.testing.records, item.gameplay_videos);
    assert.equal(result.nodes.length, 0);
    assert.equal(result.unlinkedMedia.length, item.gameplay_videos.length);
    assert.ok(result.unlinkedMedia.length > 0);
    assert.equal(item.stage_date, null);
  }
});
test('an explicit missing or unconfirmed video target never falls onto a nearby test', () => {
  const build = mediaBuilder();
  const milestone = {date:'2026-09-20',type:'上线前测试',title:'连接测试正式开启'};
  const explicit = {date:'2026-09-23',milestone_date:'2026-09-22',url:'https://example.com/other-round',type:'实机'};
  const unconfirmed = {date:'2026-09-20',node_link_status:'unconfirmed',url:'https://example.com/unknown-round',type:'实机'};
  const result = build([milestone],[explicit,unconfirmed]);
  assert.equal(result.nodes[0].evidence.length, 0);
  assert.equal(result.unlinkedMedia.length, 2);
});
test('fish daily chart is computed only from archived real samples', () => {
  const raw = read('tests/fixtures/how-to-fish-chart-samples-2026-09-07.json');
  const trend = read('public/supplemental-trends.json')['How to Fish'];
  const days = new Map();
  for (const [time, value] of raw.samples) {
    const day = new Date(time).toISOString().slice(0, 10);
    days.set(day, Math.max(days.get(day) || 0, value));
  }
  assert.deepEqual(trend.activity.points, [...days].map(([date, value]) => ({date, value})));
  assert.equal(trend.activity.points[0].date, '2026-08-23');
  assert.match(trend.activity.label, /CCU/);
  assert.equal(trend.revenue.points, undefined);
});
test('berry first-test range and official source survive editorial end-state merging', () => {
  const page = fs.readFileSync(new URL('app/page.tsx', root), 'utf8');
  const source = page.slice(page.indexOf('function lifecyclePhase('), page.indexOf('function ProjectProgressMedia('));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const getNodes = new Function('recordText', 'dateKey', 'shortDate', 'readableHeadline', 'timelineStatus', 'evidenceKind', js + '; return condensedProgressNodes;')(
    (item, key) => typeof item[key] === 'string' ? item[key] : '',
    value => typeof value === 'string' ? value.slice(0, 10) : '',
    value => value.replaceAll('-', '.'), value => value, () => 'confirmed', () => 'report'
  );
  const detail = read('public/dashboard_data.json').pipelineDetails['集合！浆果镇'];
  const nodes = getNodes([...detail.testing.records, { date: '2026-08-01', title: '尝鲜首测已结束', source: '看板研判', summary: '编辑结论' }]);
  assert.equal(nodes.length, 3);
  const first = nodes.find(node => node.phase === 'first');
  assert.equal(first.displayDate, '2026.07.23–08.01');
  assert.equal(first.source, 'TapTap 官方');
  assert.match(first.summary, /安卓限量、删档、不计费/);
  assert(first.url.includes('829083364769136788'));
  assert(detail.gameplay_videos.some(video => video.evidence_kind === 'video' && video.date === '2026-07-20'));
  assert.match(page, /item\.source \|\| item\.platform \|\| "公开信源"/);
});

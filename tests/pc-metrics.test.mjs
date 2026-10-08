import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeMetricMaps } from '../app/pc-metrics.ts';
import { completeDailyAverages, parseSteamCharts, parseSteamReviews } from '../scripts/refresh-steam-products.mjs';

test('SteamCharts and Steam review parsing reject missing or inconsistent evidence', () => {
 const html = '<h1 id="app-title">Dressmaker</h1><div id="app-heading"><div class="app-stat"><span class="num">20,000</span><abbr class="timeago" title="2026-09-30T06:00:00Z"></abbr></div><div class="app-stat"><span class="num">30,000</span></div><div class="app-stat"><span class="num">35,468</span></div></div><table class="common-table"><tbody><tr><td>Last 30 Days</td><td>21,747.98</td><td></td><td></td><td>35,468</td></tr></tbody></table>';
 const metrics = parseSteamCharts(html, 'Dressmaker');
 assert.equal(metrics.averageCcu, 21747.98);
 assert.equal(metrics.peakCcu, 35468);
 assert.throws(() => parseSteamCharts(html, 'Another Game'), /身份不匹配/);
 assert.deepEqual(parseSteamReviews({success:1,query_summary:{total_positive:6461,total_negative:134,total_reviews:6595}}),{count:6595,score:97.97});
 assert.throws(() => parseSteamReviews({success:1,query_summary:{total_positive:6461,total_negative:134,total_reviews:6500}}), /计数异常/);
});

test('SteamCharts hourly samples yield only complete UTC days', () => {
 const complete = Array.from({length:24},(_,hour)=>[Date.parse(`2026-09-29T${String(hour).padStart(2,'0')}:00:00Z`),100+hour]);
 const partial = Array.from({length:8},(_,hour)=>[Date.parse(`2026-09-30T${String(hour).padStart(2,'0')}:00:00Z`),200+hour]);
 assert.deepEqual(completeDailyAverages([...complete,...partial]),[{date:'2026-09-29',value:112}]);
});
test('PC merge keeps valid dated fields when refresh is missing and preserves zero',()=>{
 const old={Game:{peak_ccu:20,revenue_30d:50,data_date:'2026-08-01',source_url:'old'}};
 const latest={Game:{peak_ccu:null,revenue_30d:0,data_date:'2026-09-01',source_url:'new'}};
 const g=mergeMetricMaps(old,latest).Game;
 assert.equal(g.peak_ccu,20);assert.equal(g.revenue_30d,0);assert.equal(g.review_score,null);
 assert.equal(g.field_sources.peak_ccu.date,'2026-08-01');
 assert.equal(g.field_sources.revenue_30d.url,'new');
});
test('PC merge chooses newest per-field evidence, not bundle order',()=>{
 const g=mergeMetricMaps({G:{review_score:98,data_date:'2026-08-01',field_sources:{review_score:{date:'2026-09-09',url:'official'}}}},{G:{review_score:90,data_date:'2026-09-01'}}).G;
 assert.equal(g.review_score,98);assert.equal(g.field_sources.review_score.url,'official');
});
test('PC merge retains the newer Steam snapshot date and source when DataBrain is older',()=>{
 const steam={G:{average_ccu:25000,review_score:98,data_date:'2026-10-08',source:'SteamCharts / Steam 官方评价',source_url:'https://steamcharts.com/app/4019220',note:'Steam snapshot'}};
 const databrain={G:{average_ccu:22000,peak_ccu:40000,data_date:'2026-10-07',source:'alinea',source_url:'https://databrain.woa.com/test',note:'Older estimate'}};
 const g=mergeMetricMaps(steam,databrain).G;
 assert.equal(g.average_ccu,25000);
 assert.equal(g.peak_ccu,40000);
 assert.equal(g.data_date,'2026-10-08');
 assert.equal(g.source,steam.G.source);
 assert.equal(g.source_url,steam.G.source_url);
 assert.equal(g.note,steam.G.note);
 assert.equal(g.field_sources.peak_ccu.date,'2026-10-07');
});
test('Stardew has separate PC ACU and revenue histories alongside mobile DAU',()=>{
 const read=f=>JSON.parse(fs.readFileSync(new URL('../public/'+f,import.meta.url)));
 const pc=read('pc-trends.json').games['星露谷物语'];
 const mobile=read('databrain_trends_90d.json').games['星露谷物语'];
 assert.equal(pc.activity.label,'PC 日均 ACU');assert.equal(mobile.activity.label,'DAU');
 assert(pc.activity.points.length>=80);assert(pc.revenue.points.length>=80);
 assert.notDeepEqual(pc.activity.points,mobile.activity.points);
 for(const t of Object.values(read('pc-trends.json').games))for(const s of [t.activity,t.revenue]){
  assert.equal(new Set(s.points.map(p=>p.date)).size,s.points.length);
  assert(s.points.every(p=>Number.isFinite(p.value)&&p.value>=0));
 }
});
test('Sandrock PC metrics use Steam App ID 1084600 and include refreshed daily trends',()=>{
 const read=f=>JSON.parse(fs.readFileSync(new URL('../public/'+f,import.meta.url)));
 const metric=read('pc-metrics.json').games['沙石镇时光'];
 assert.equal(metric.average_ccu,835);
 assert.equal(metric.historical_peak_ccu,21620);
 assert.deepEqual(metric.review_score_range,[88,89]);
 assert.match(metric.note,/1084600/);
 const trend=read('pc-trends.json').games['沙石镇时光'];
 assert.equal(trend.activity.label,'PC 日均 ACU');
 assert(trend.activity.points.length>=80);assert(trend.revenue.points.length>=60);
 assert.match(trend.end_date,/^2026-\d{2}-\d{2}$/);
});
test('Wanxiangqi uses its Chinese DataBrain identity without Chinese Chess PC leakage',()=>{
 const read=f=>JSON.parse(fs.readFileSync(new URL('../public/'+f,import.meta.url)));
 const metrics=read('databrain_latest_metrics.json');
 const trends=read('databrain_trends_90d.json');
 const mobile=metrics.mobile_games['王者万象棋'];
 const trend=trends.games['王者万象棋'];
 assert.equal(mobile.data_date,'2026-09-18');
 assert.match(mobile.source,/Sensor Tower/);
 assert.equal(trend.activity.label,'DAU');
 assert.equal(trend.activity.scope,'移动端 App Store 全球');
 assert.equal(trend.activity.points.length,9);
 assert.equal(trend.revenue.points.length,9);
 assert.equal(metrics.pc_games['王者万象棋'],undefined);
 assert.equal(trends.games['Chinese Chess'],undefined);
});

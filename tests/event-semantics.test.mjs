import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const page = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const source = page.slice(page.indexOf('function isProductEventEvidence('), page.indexOf('function buildRadarEvents('));
const compiled = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const {makeRadarEvent, isProductEventEvidence} = new Function('recordText','dateKey','shiftDate','readableHeadline', compiled + ';return {makeRadarEvent,isProductEventEvidence};')(
  (o,k)=>typeof o[k]==='string'?o[k]:'', s=>s.slice(0,10),
  (s,n)=>new Date(Date.parse(s)+n*86400000).toISOString().slice(0,10), s=>s);
test('research articles are evidence, not product update events',()=>{
  assert.equal(isProductEventEvidence({title:'GRP：How to Fish 合作捕鱼与社交循环分析'}),false);
  assert.equal(isProductEventEvidence({title:'BigWalk Steam 走红'}),false);
  assert.equal(isProductEventEvidence({title:'全新赛季更新'}),true);
});
test('planned release is a release, never auto-confirmed after its date',()=>{
  const event=makeRadarEvent({name:'测试产品'}, {date:'2026-09-04',title:'App Store 预计正式推出',status:'planned',published_date:'2026-08-24'},'新测试','pipeline','在研新品','2026-09-07');
  assert.equal(event.kind,'上线节点');assert.equal(event.status,'待核验');
  assert.equal(event.publishedDate,'2026-08-24');assert.equal(event.dateMeaning,'事件日期');
});
test('legacy news dates are not silently promoted to occurrence dates',()=>{
  const event=makeRadarEvent({name:'心动小镇'}, {date:'2026-08-15',title:'七夕活动即将开启'},'版本更新','game','热门游戏','2026-09-07');
  assert.equal(event.dateMeaning,'消息日期');assert.equal(event.status,'待核验');
});

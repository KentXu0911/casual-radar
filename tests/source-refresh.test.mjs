import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const d=JSON.parse(fs.readFileSync(new URL('../public/dashboard_data.json',import.meta.url)));
const g=JSON.parse(fs.readFileSync(new URL('../public/games.json',import.meta.url)));
test('source refresh keeps new products in correct lifecycle and both data feeds',()=>{
 for(const data of [d,g]){
  const berry=data.games.filter(x=>x.name==='集合！浆果镇');
  assert.equal(berry.length,1);assert.equal(berry[0].lifecycle.pipeline,true);
  const fish=data.games.filter(x=>x.name==='How to Fish');
  assert.equal(fish.length,1);assert.equal(fish[0].lifecycle.pipeline,false);
  assert.equal(fish[0].release_date,'2026-08-20');assert.deepEqual(fish[0].metrics,{});
 }
 assert(d.pipelineGroups.some(x=>x.projects.includes('集合！浆果镇')));
 assert(!d.pipelineGroups.some(x=>x.projects.includes('How to Fish')));
});
test('official confirmation updates the existing milestone without creating another test',()=>{
 const starRecords=d.pipelineDetails['星布谷地'].testing.records.filter(x=>x.date==='2026-09-20');
 assert.equal(starRecords.length,1);
 const star=starRecords[0];
 assert.equal(star.status,'confirmed');assert.equal(star.observed_date,'2026-08-26');
 assert.equal(star.verified_at,'2026-10-08');
 assert.equal(star.url,'https://www.taptap.cn/moment/850015424484475954');
 assert.equal(d.pipelineDetails['雾海之下'].testing.records.length,3);
 assert(d.pipelineDetails['雾海之下'].gameplay_videos.some(x=>x.url.endsWith('id=171')&&x.milestone_date==='2026-08-17'));
 const berryTests=d.pipelineDetails['集合！浆果镇'].testing.records.filter(x=>x.lifecycle_phase==='first');
 assert.equal(berryTests.length,1);
 assert.equal(berryTests[0].date,'2026-07-23');
});
test('license approval and unknown test dates do not imply a first test',()=>{
 const page=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const source=page.slice(page.indexOf('function lifecyclePhase('),page.indexOf('function lifecycleLabel('))
  +page.slice(page.indexOf('function pipelineMatrixStageFromText('),page.indexOf('function pipelineMatrixEntry('));
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const classify=new Function('recordText',js+';return pipelineMatrixStageFromText;')((item,key)=>String(item[key]||''));
 const approval=d.pipelineDetails['源初之结'].testing.records.find(x=>x.type==='版号获批');
 assert.equal(classify(`${approval.type} ${approval.title}`,approval),null);
 const stage=d.pipelineDetails['源初之结'].stage;
 assert.equal(classify(stage,{type:'当前阶段',title:stage}),null);
 assert.equal(classify('测试与上线未定',{type:'当前阶段',title:'测试与上线未定'}),null);
 const project=d.pipelineDetails.Project63.stage;
 assert.equal(classify(project,{type:'当前阶段',title:project}),'first');
 assert.equal(d.pipelineDetails.Project63.stage_date,null);
});
test('reviewed discovery articles remain visible as reports with their named publisher',()=>{
 const page=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 const source=page.slice(page.indexOf('const MAJOR_VERSION_PATTERN ='),page.indexOf('function ProductIntelligenceBoard('));
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const columns=new Function('recordText','recordList','dateKey','productMilestones',js+';return productIntelligenceColumns;')(
  (item,key)=>String(item[key]||''),value=>Array.isArray(value)?value:[],value=>String(value||'').slice(0,10),()=>[]);
 const product={name:'报告展示样本',intelligence:{recent_articles:[{title:'产品核心循环拆解',date:'2026-10-07',source:'游研所收录 · 游戏本稚',type:'公众号报道',url:'https://example.com/review',summary:'分析核心循环与体验。'}]}};
 const result=columns(product);
 const reviewed=product.intelligence.recent_articles.find(x=>x.source==='游研所收录 · 游戏本稚');
 assert.ok(reviewed);
 assert.ok(result.find(x=>x.id==='reports').items.some(x=>x.url===reviewed.url&&x.source===reviewed.source));
 assert.equal(result.find(x=>x.id==='version').items.length,0);
 assert.equal(result.find(x=>x.id==='gameplay').items.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveGameIconPath} from '../app/game-icon-path.ts';
const icons=JSON.parse(fs.readFileSync(new URL('../public/supplemental-icons.json',import.meta.url)));
test('all supplemental icons exist as real downloaded images',()=>{
 assert.equal(Object.keys(icons).length,11);
 for(const [name,icon] of Object.entries(icons)){
  assert.equal(resolveGameIconPath(name,undefined,icons),icon.path);
  const b=fs.readFileSync(new URL('../public'+icon.path,import.meta.url));
  assert(b.length>500);assert(b[0]===0xff||b[0]===0x89||b.toString('ascii',0,4)==='RIFF',name);
 }
});
test('real icons replace placeholders without changing existing icons or unknown names',()=>{
 assert.equal(resolveGameIconPath('集合！浆果镇','/game-icons/placeholder-berry.svg',icons),icons['集合！浆果镇'].path);
 assert.equal(resolveGameIconPath('How to Fish','/game-icons/placeholder-how-to-fish.svg',icons),icons['How to Fish'].path);
 assert.equal(resolveGameIconPath('球球大作战','/existing.jpg',icons),'/existing.jpg');
 assert.equal(resolveGameIconPath('Rolling! Legions',undefined,icons),undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isRecentIntake, categoryIntakes } from '../app/game-intake.ts';
const records = JSON.parse(fs.readFileSync(new URL('../public/game-intake.json', import.meta.url)));
test('new intake lasts seven days and excludes future or missing dates', () => {
  const record = records['How to Fish'];
  assert(isRecentIntake(record, '2026-09-07'));
  assert(isRecentIntake(record, '2026-09-13'));
  assert(!isRecentIntake(record, '2026-09-14'));
  assert(!isRecentIntake(record, '2026-09-06'));
  assert(!isRecentIntake(undefined, '2026-09-07'));
});
test('new released and pipeline games surface only in their category without duplicates', () => {
  const games = JSON.parse(fs.readFileSync(new URL('../public/games.json', import.meta.url))).games;
  assert.deepEqual(categoryIntakes([...games, ...games], '模拟经营类', records, '2026-09-07').map(g => g.name), ['集合！浆果镇']);
  assert.deepEqual(categoryIntakes(games, '社交-多人合作类', records, '2026-09-07').map(g => g.name), ['How to Fish']);
  assert.equal(categoryIntakes(games, '模拟经营类', records, '2026-09-14').length, 0);
  assert.deepEqual(categoryIntakes(games, '自走棋', records, '2026-09-20').map(g => g.name), ['多多自走棋', 'Mechabellum', 'The Bazaar', 'Once Upon a Galaxy', '妖妖棋']);
  assert.equal(games.find(g => g.name === '集合！浆果镇').lifecycle.stage_date, '2026-08-01');
});

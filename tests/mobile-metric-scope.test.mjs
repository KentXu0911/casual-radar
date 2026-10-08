import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileMetricScope } from '../app/mobile-metric-scope.ts';
test('PC and console snapshots never appear as mobile data', () => {
  for (const scope of ['pc_console','pc','steam','console']) assert.equal(isMobileMetricScope(scope,'PC/主机'),false);
  assert.equal(isMobileMetricScope('pc_console','iOS/PC'),false);
  assert.equal(isMobileMetricScope(undefined,'PC/主机'),false);
  assert.equal(isMobileMetricScope('mobile','iOS/Android'),true);
  assert.equal(isMobileMetricScope(undefined,'iOS/Android/PC'),true);
});

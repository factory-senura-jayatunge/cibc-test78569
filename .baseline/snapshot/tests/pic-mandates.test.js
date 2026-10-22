import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccount } from '../src/platform/accounts.js';
import { allocation, driftReport } from '../src/lob/pic/mandates.js';

test('computes allocation weights including cash', () => {
  assert.deepEqual(allocation(getAccount('PIC-77004101')), { equity: 0.615, 'fixed-income': 0.2555, cash: 0.1294 });
});

test('flags drift beyond the mandate tolerance', () => {
  const report = driftReport('PIC-77004101');
  assert.equal(report.mandate, 'Balanced Income');
  assert.equal(report.rows.find((row) => row.assetClass === 'equity').drift, 0.115);
  assert.equal(report.needsRebalance, true);
});

test('accounts without a mandate are rejected', () => {
  assert.throws(() => driftReport('IE-58210043'), { code: 'NOT_FOUND' });
});

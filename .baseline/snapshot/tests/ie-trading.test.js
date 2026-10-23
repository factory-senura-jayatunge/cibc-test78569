import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionsValue, previewOrder } from '../src/lob/investors-edge/trading.js';

test('previews a buy with commission', () => {
  const order = previewOrder({ accountId: 'IE-58210043', symbol: 'NSE-CDNEQ', side: 'buy', qty: 10 });
  assert.equal(order.gross, 384.2);
  assert.equal(order.commission, 6.95);
  assert.equal(order.estimatedNet, 391.15);
});

test('previews a sell net of commission for an active trader', () => {
  const order = previewOrder({ accountId: 'IE-58210077', symbol: 'NSE-USEQ', side: 'sell', qty: 100 });
  assert.equal(order.commission, 4.95);
  assert.equal(order.estimatedNet, 6110.05);
});

test('rejects selling more than held', () => {
  assert.throws(() => previewOrder({ accountId: 'IE-58210043', symbol: 'NSE-CDNEQ', side: 'sell', qty: 301 }), { code: 'INVALID_ORDER' });
});

test('rejects buys without enough cash', () => {
  assert.throws(() => previewOrder({ accountId: 'IE-58210043', symbol: 'NSE-USEQ', side: 'buy', qty: 400 }), /Insufficient cash/);
});

test('rejects non-positive quantities', () => {
  assert.throws(() => previewOrder({ accountId: 'IE-58210043', symbol: 'NSE-CDNEQ', side: 'buy', qty: 0 }), { code: 'INVALID_ORDER' });
});

test("rejects orders on accounts outside Investor's Edge", () => {
  assert.throws(() => previewOrder({ accountId: 'WG-30115520', symbol: 'NSE-CDNEQ', side: 'buy', qty: 1 }), { code: 'INVALID_ORDER' });
});

test('values positions for collateral use', () => {
  assert.equal(positionsValue('IE-58210077'), 95024);
});

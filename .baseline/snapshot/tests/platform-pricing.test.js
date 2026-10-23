import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetClassOf, getPrice, marketValue } from '../src/platform/pricing.js';

test('prices known symbols', () => {
  assert.equal(getPrice('NSE-CDNEQ'), 38.42);
});

test('values a set of positions to the cent', () => {
  assert.equal(marketValue([{ symbol: 'NSE-CDNEQ', qty: 300 }, { symbol: 'NSE-AGGBD', qty: 500 }]), 16461);
});

test('an empty book is worth zero', () => {
  assert.equal(marketValue(), 0);
});

test('classifies asset classes', () => {
  assert.equal(assetClassOf('NSE-AGGBD'), 'fixed-income');
});

test('unknown symbols throw', () => {
  assert.throws(() => getPrice('NOPE'), { code: 'NOT_FOUND' });
});

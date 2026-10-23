import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEE_SCHEDULES, commissionFor, tieredAnnualFee } from '../src/platform/fees.js';
import { roundCents, roundRatio } from '../src/platform/money.js';

const tiers = FEE_SCHEDULES['wood-gundy'].tiers;

test('charges the first tier only below 250k', () => {
  assert.equal(tieredAnnualFee(200000, tiers), 3000);
});

test('blends tiers marginally', () => {
  assert.equal(tieredAnnualFee(273600, tiers), 4045);
  assert.equal(tieredAnnualFee(1200000, tiers), 15125);
});

test('zero assets means zero fee', () => {
  assert.equal(tieredAnnualFee(0, tiers), 0);
});

test('rejects negative or missing assets', () => {
  assert.throws(() => tieredAnnualFee(-1, tiers), RangeError);
  assert.throws(() => tieredAnnualFee(undefined, tiers), RangeError);
});

test('active traders get the lower commission', () => {
  assert.equal(commissionFor(14), 6.95);
  assert.equal(commissionFor(30), 4.95);
});

test('money helpers round half away from float noise', () => {
  assert.equal(roundCents(0.1 + 0.2), 0.3);
  assert.equal(roundRatio(0.615 - 0.5), 0.115);
});

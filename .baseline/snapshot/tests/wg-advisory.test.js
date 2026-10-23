import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccount } from '../src/platform/accounts.js';
import { advisoryFeeForQuarter, annualAdvisoryFee, householdAssets } from '../src/lob/wood-gundy/advisory.js';

const account = getAccount('WG-30115520');

test('household assets include cash and holdings', () => {
  assert.equal(householdAssets(account), 273600);
});

test('annual advisory fee uses the tiered schedule', () => {
  assert.equal(annualAdvisoryFee(account), 4045);
});

test('quarterly fee is a quarter of the annual fee', () => {
  assert.equal(advisoryFeeForQuarter(account), 1011.25);
});

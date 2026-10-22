import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditSummary } from '../src/lob/private-banking/credit.js';

test('summarizes the credit facility', () => {
  const credit = creditSummary('PB-12003885');
  assert.equal(credit.available, 68000);
  assert.equal(credit.collateralAccount, 'IE-58210077');
});

test('loan-to-value uses the pledged portfolio', () => {
  assert.equal(creditSummary('PB-12003885').loanToValue, 0.5472);
});

test('rejects accounts that are not credit facilities', () => {
  assert.throws(() => creditSummary('IE-58210043'), RangeError);
});

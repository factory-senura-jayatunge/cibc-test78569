import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditSummary, ltvStatus } from '../src/lob/private-banking/credit.js';

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

test('PB-2210 AC1: creditSummary classifies loan-to-value into ltvStatus', () => {
  assert.equal(creditSummary('PB-12003885').ltvStatus, 'ok');
  assert.equal(ltvStatus(0.3), 'ok');
  assert.equal(ltvStatus(0.65), 'watch');
  assert.equal(ltvStatus(0.85), 'margin-call-warning');
});

test('PB-2210 AC4: ltvStatus boundary values', () => {
  assert.equal(ltvStatus(0.5999), 'ok');
  assert.equal(ltvStatus(0.6), 'watch');
  assert.equal(ltvStatus(0.7), 'watch');
  assert.equal(ltvStatus(0.7001), 'margin-call-warning');
  assert.equal(ltvStatus(Infinity), 'margin-call-warning');
});

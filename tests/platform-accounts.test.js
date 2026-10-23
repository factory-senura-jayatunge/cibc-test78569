import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAccount, listAccounts } from '../src/platform/accounts.js';

test('lists accounts for one line of business', () => {
  const ids = listAccounts('investors-edge').map((account) => account.id);
  assert.deepEqual(ids, ['IE-58210043', 'IE-58210077']);
});

test('lists every account when no line of business is given', () => {
  assert.equal(listAccounts().length, 5);
});

test('returns a copy so callers cannot mutate the book', () => {
  const account = getAccount('IE-58210043');
  account.cash = 0;
  assert.equal(getAccount('IE-58210043').cash, 12450);
});

test('unknown account throws NOT_FOUND', () => {
  assert.throws(() => getAccount('XX-1'), { code: 'NOT_FOUND' });
});

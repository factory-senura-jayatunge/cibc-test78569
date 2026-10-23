import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { clear, entries, record } from '../src/platform/audit.js';

beforeEach(() => clear());

test('records an audit entry', () => {
  record('statement.generated', 'IE-58210043', { quarter: '2026-Q3' });
  const [entry] = entries();
  assert.equal(entry.event, 'statement.generated');
  assert.equal(entry.accountId, 'IE-58210043');
});

test('entries returns a copy', () => {
  record('x', 'IE-58210043');
  entries().pop();
  assert.equal(entries().length, 1);
});

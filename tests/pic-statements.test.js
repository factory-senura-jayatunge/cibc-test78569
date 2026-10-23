import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/pic/index.js';

test('PIC statement totals the discretionary portfolio', () => {
  assert.equal(statementFor('PIC-77004101', '2026-Q3').total, 1158780);
});

test('includes the mandate section with a rebalance flag', () => {
  const [section] = statementFor('PIC-77004101', '2026-Q3').sections;
  assert.equal(section.title, 'Discretionary mandate');
  assert.equal(section.rows.at(-1).value, 'Yes');
});

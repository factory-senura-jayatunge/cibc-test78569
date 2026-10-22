import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/wood-gundy/index.js';

test('Wood Gundy statement deducts the quarterly advisory fee', () => {
  const statement = statementFor('WG-30115520', '2026-Q3');
  const fee = statement.lines.find((line) => line.label === 'Advisory fee charged this quarter');
  assert.equal(fee.amount, -1011.25);
  assert.equal(statement.total, 272588.75);
});

test('shows the advisory relationship', () => {
  const [section] = statementFor('WG-30115520', '2026-Q3').sections;
  assert.equal(section.title, 'Advisory relationship');
  assert.equal(section.rows.find((row) => row.label === 'Advisor').value, 'R. Okafor');
});

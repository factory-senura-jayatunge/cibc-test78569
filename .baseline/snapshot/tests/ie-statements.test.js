import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/investors-edge/index.js';

test("Investor's Edge statement totals cash and holdings", () => {
  const statement = statementFor('IE-58210043', '2026-Q3');
  assert.deepEqual(statement.lines.map((line) => line.label), ['Cash', 'Holdings at market value']);
  assert.equal(statement.total, 28911);
});

test('includes trading activity', () => {
  const [section] = statementFor('IE-58210043', '2026-Q3').sections;
  assert.equal(section.title, 'Trading activity');
  assert.equal(section.rows[0].value, 14);
});

test('rejects malformed quarters', () => {
  assert.throws(() => statementFor('IE-58210043', 'Q3-2026'), RangeError);
});

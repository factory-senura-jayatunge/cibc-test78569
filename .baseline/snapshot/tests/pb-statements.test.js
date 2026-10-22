import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/private-banking/index.js';

test('Private Banking statement shows the operating cash balance', () => {
  const statement = statementFor('PB-12003885', '2026-Q3');
  assert.deepEqual(statement.lines, [{ label: 'Cash', amount: 8200 }]);
  assert.equal(statement.total, 8200);
});

test('includes the credit facility section', () => {
  const [section] = statementFor('PB-12003885', '2026-Q3').sections;
  assert.equal(section.title, 'Credit facility');
  assert.equal(section.rows.find((row) => row.label === 'Loan-to-value').value, 0.5472);
});

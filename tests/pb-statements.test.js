import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/private-banking/index.js';
import { statementFor as investorsEdgeStatement } from '../src/lob/investors-edge/index.js';
import { statementFor as woodGundyStatement } from '../src/lob/wood-gundy/index.js';
import { statementFor as picStatement } from '../src/lob/pic/index.js';

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

test('PB-2210 AC2: Credit facility section shows an LTV status row', () => {
  const section = statementFor('PB-12003885', '2026-Q3').sections.find((s) => s.title === 'Credit facility');
  const labels = section.rows.map((row) => row.label);
  assert.equal(labels.indexOf('LTV status'), labels.indexOf('Loan-to-value') + 1);
  assert.equal(section.rows.find((row) => row.label === 'LTV status').value, 'ok');
});

test('PB-2210 AC3: statements for other lines of business have no LTV status row', () => {
  const others = [
    [investorsEdgeStatement, 'IE-58210043'],
    [woodGundyStatement, 'WG-30115520'],
    [picStatement, 'PIC-77004101'],
  ];
  for (const [statementFn, accountId] of others) {
    const statement = statementFn(accountId, '2026-Q3');
    for (const section of statement.sections) {
      assert.ok(!section.rows.some((row) => row.label === 'LTV status'), `${accountId} ${section.title}`);
    }
  }
});

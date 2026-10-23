import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statementFor } from '../src/lob/wood-gundy/index.js';
import { statementFor as ieStatementFor } from '../src/lob/investors-edge/index.js';
import { statementFor as picStatementFor } from '../src/lob/pic/index.js';
import { statementFor as pbStatementFor } from '../src/lob/private-banking/index.js';

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

const RATE_LABEL = 'Effective annual advisory fee rate (bps)';
const TRAILING_LABEL = 'Advisory fees, trailing four quarters';

function advisorySection(accountId) {
  return statementFor(accountId, '2026-Q3').sections.find((s) => s.title === 'Advisory relationship');
}

test('WG-1042 AC1: shows the effective annual advisory fee rate in bps to one decimal', () => {
  const row = advisorySection('WG-30115520').rows.find((r) => r.label === RATE_LABEL);
  assert.ok(row, 'rate row is missing');
  assert.equal(row.value, 147.8);
});

test('WG-1042 AC2: shows advisory fees for the trailing four quarters', () => {
  const row = advisorySection('WG-30115520').rows.find((r) => r.label === TRAILING_LABEL);
  assert.ok(row, 'trailing four quarters row is missing');
  assert.equal(row.value, 4045);
});

test('WG-1042 AC3: Investor\'s Edge, PIC, and Private Banking statements do not show the new rows', () => {
  const others = [
    ieStatementFor('IE-58210043', '2026-Q3'),
    ieStatementFor('IE-58210077', '2026-Q3'),
    picStatementFor('PIC-77004101', '2026-Q3'),
    pbStatementFor('PB-12003885', '2026-Q3'),
  ];
  for (const statement of others) {
    assert.ok(!statement.sections.some((s) => s.title === 'Advisory relationship'));
    const labels = statement.sections.flatMap((s) => s.rows.map((r) => r.label));
    assert.ok(!labels.includes(RATE_LABEL));
    assert.ok(!labels.includes(TRAILING_LABEL));
  }
});

test('WG-1042 AC4: advisory relationship section keeps existing rows and adds both numeric disclosure rows', () => {
  const section = advisorySection('WG-30115520');
  const labels = section.rows.map((r) => r.label);
  assert.deepEqual(labels, [
    'Advisor',
    'Household assets',
    'Annual advisory fee (projected)',
    RATE_LABEL,
    TRAILING_LABEL,
  ]);
  for (const label of [RATE_LABEL, TRAILING_LABEL]) {
    const { value } = section.rows.find((r) => r.label === label);
    assert.equal(typeof value, 'number');
    assert.ok(Number.isFinite(value) && value > 0);
  }
});

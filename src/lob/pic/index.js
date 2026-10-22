import { buildQuarterlyStatement } from '../../platform/statements.js';
import { driftReport } from './mandates.js';

export { driftReport } from './mandates.js';

export function statementFor(accountId, quarter) {
  const statement = buildQuarterlyStatement(accountId, quarter);
  const drift = driftReport(accountId);
  statement.sections.push({
    title: 'Discretionary mandate',
    rows: [
      { label: 'Mandate', value: drift.mandate },
      ...drift.rows.map((row) => ({ label: `${row.assetClass} (target ${row.target})`, value: row.actual })),
      { label: 'Rebalance recommended', value: drift.needsRebalance ? 'Yes' : 'No' },
    ],
  });
  return statement;
}

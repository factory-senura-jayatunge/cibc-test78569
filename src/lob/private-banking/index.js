import { buildQuarterlyStatement } from '../../platform/statements.js';
import { FEE_SCHEDULES } from '../../platform/fees.js';
import { creditSummary } from './credit.js';

export { creditSummary } from './credit.js';

export function statementFor(accountId, quarter) {
  const statement = buildQuarterlyStatement(accountId, quarter);
  const credit = creditSummary(accountId);
  statement.sections.push({
    title: 'Credit facility',
    rows: [
      { label: 'Limit', value: credit.limit },
      { label: 'Drawn', value: credit.drawn },
      { label: 'Available', value: credit.available },
      { label: 'Loan-to-value', value: credit.loanToValue },
      { label: 'Annual service fee', value: FEE_SCHEDULES['private-banking'].annualServiceFee },
    ],
  });
  return statement;
}

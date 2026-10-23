import { buildQuarterlyStatement } from '../../platform/statements.js';
import { getAccount } from '../../platform/accounts.js';
import { commissionFor } from '../../platform/fees.js';

export { previewOrder, positionsValue } from './trading.js';

export function statementFor(accountId, quarter) {
  const statement = buildQuarterlyStatement(accountId, quarter);
  const account = getAccount(accountId);
  statement.sections.push({
    title: 'Trading activity',
    rows: [
      { label: 'Trades this quarter', value: account.tradesThisQuarter },
      { label: 'Commission per trade', value: commissionFor(account.tradesThisQuarter) },
    ],
  });
  return statement;
}

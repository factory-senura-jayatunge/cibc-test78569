import { buildQuarterlyStatement } from '../../platform/statements.js';
import { getAccount } from '../../platform/accounts.js';
import { annualAdvisoryFee, householdAssets } from './advisory.js';

export function statementFor(accountId, quarter) {
  const statement = buildQuarterlyStatement(accountId, quarter);
  const account = getAccount(accountId);
  statement.sections.push({
    title: 'Advisory relationship',
    rows: [
      { label: 'Advisor', value: account.advisor },
      { label: 'Household assets', value: householdAssets(account) },
      { label: 'Annual advisory fee (projected)', value: annualAdvisoryFee(account) },
    ],
  });
  return statement;
}

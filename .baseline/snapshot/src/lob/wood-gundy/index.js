import { buildQuarterlyStatement } from '../../platform/statements.js';
import { getAccount } from '../../platform/accounts.js';
import { annualAdvisoryFee, householdAssets } from './advisory.js';
import { renderDisclosureLetter } from './disclosure.js';

// WG-977: advisory fee disclosure letters. The letter is the client-facing document, so it
// carries the holder name and account number; audit output inside disclosure.js masks them.
export function feeDisclosureLetter(accountId, request = {}) {
  const account = getAccount(accountId);
  if (account.lob !== 'wood-gundy') throw new RangeError(`Account ${accountId} is not a Wood Gundy advisory account`);
  const letterData = {
    holder: account.holder,
    accountId: account.id,
    advisor: account.advisor,
    householdAssets: householdAssets(account),
    annualFee: annualAdvisoryFee(account),
  };
  return renderDisclosureLetter(accountId, request, letterData);
}

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

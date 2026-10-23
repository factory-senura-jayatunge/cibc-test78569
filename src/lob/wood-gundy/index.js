import { buildQuarterlyStatement } from '../../platform/statements.js';
import { getAccount } from '../../platform/accounts.js';
import { roundCents, roundRatio } from '../../platform/money.js';
import { annualAdvisoryFee, householdAssets, advisoryFeeForQuarter } from './advisory.js';
import { renderDisclosureLetter } from './disclosure.js';

// One decimal of bps is five decimals of the ratio, one more than roundRatio keeps,
// so roundRatio runs on ratio * 10. roundCents only clears float noise from the rescale.
function effectiveFeeRateBps(account) {
  const assets = householdAssets(account);
  if (!assets) return 0;
  const ratioTimesTen = roundRatio((annualAdvisoryFee(account) / assets) * 10);
  return roundCents(ratioTimesTen * 1000);
}

function trailingFourQuarterFees(account) {
  return roundCents(advisoryFeeForQuarter(account) * 4);
}

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
      { label: 'Effective annual advisory fee rate (bps)', value: effectiveFeeRateBps(account) },
      { label: 'Advisory fees, trailing four quarters', value: trailingFourQuarterFees(account) },
    ],
  });
  return statement;
}

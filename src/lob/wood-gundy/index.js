import { buildQuarterlyStatement } from '../../platform/statements.js';
import { getAccount } from '../../platform/accounts.js';
import { roundCents, roundRatio } from '../../platform/money.js';
import { annualAdvisoryFee, householdAssets, advisoryFeeForQuarter } from './advisory.js';

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

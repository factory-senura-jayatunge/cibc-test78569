import { getAccount } from '../../platform/accounts.js';
import { roundCents, roundRatio } from '../../platform/money.js';
import { positionsValue } from '../investors-edge/trading.js';

export function loanToValue(account) {
  const collateral = positionsValue(account.collateralAccount);
  if (collateral <= 0) return Infinity;
  return roundRatio(account.drawn / collateral);
}

// Expects a ratio already rounded with roundRatio so the 0.60 and 0.70 boundaries are stable.
export function ltvStatus(ratio) {
  if (ratio < 0.6) return 'ok';
  if (ratio <= 0.7) return 'watch';
  return 'margin-call-warning';
}

export function creditSummary(accountId) {
  const account = getAccount(accountId);
  if (account.lob !== 'private-banking') throw new RangeError(`Account ${accountId} is not a private banking credit facility`);
  const ltv = loanToValue(account);
  return {
    accountId: account.id,
    limit: account.creditLimit,
    drawn: account.drawn,
    available: roundCents(account.creditLimit - account.drawn),
    collateralAccount: account.collateralAccount,
    loanToValue: ltv,
    ltvStatus: ltvStatus(ltv),
  };
}

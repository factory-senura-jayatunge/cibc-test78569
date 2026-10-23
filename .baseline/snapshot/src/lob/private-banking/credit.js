import { getAccount } from '../../platform/accounts.js';
import { roundCents, roundRatio } from '../../platform/money.js';
import { positionsValue } from '../investors-edge/trading.js';

export function loanToValue(account) {
  const collateral = positionsValue(account.collateralAccount);
  if (collateral <= 0) return Infinity;
  return roundRatio(account.drawn / collateral);
}

export function creditSummary(accountId) {
  const account = getAccount(accountId);
  if (account.lob !== 'private-banking') throw new RangeError(`Account ${accountId} is not a private banking credit facility`);
  return {
    accountId: account.id,
    limit: account.creditLimit,
    drawn: account.drawn,
    available: roundCents(account.creditLimit - account.drawn),
    collateralAccount: account.collateralAccount,
    loanToValue: loanToValue(account),
  };
}

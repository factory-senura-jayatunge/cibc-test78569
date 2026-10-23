import { getAccount } from '../../platform/accounts.js';
import { getPrice, marketValue } from '../../platform/pricing.js';
import { commissionFor } from '../../platform/fees.js';
import { roundCents } from '../../platform/money.js';
import { record } from '../../platform/audit.js';

export class OrderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderError';
    this.code = 'INVALID_ORDER';
  }
}

export function positionsValue(accountId) {
  return marketValue(getAccount(accountId).positions);
}

export function previewOrder({ accountId, symbol, side, qty } = {}) {
  const account = getAccount(accountId);
  if (account.lob !== 'investors-edge') throw new OrderError("Orders are only supported for Investor's Edge accounts");
  if (side !== 'buy' && side !== 'sell') throw new OrderError('side must be buy or sell');
  if (!Number.isInteger(qty) || qty <= 0) throw new OrderError('qty must be a positive integer');
  const price = getPrice(symbol);
  const commission = commissionFor(account.tradesThisQuarter);
  const gross = roundCents(price * qty);
  if (side === 'buy' && gross + commission > account.cash) throw new OrderError('Insufficient cash');
  if (side === 'sell') {
    const held = account.positions.find((position) => position.symbol === symbol)?.qty ?? 0;
    if (qty > held) throw new OrderError('Cannot sell more than the position held');
  }
  const estimatedNet = side === 'buy' ? roundCents(gross + commission) : roundCents(gross - commission);
  record('order.previewed', account.id, { symbol, side, qty });
  return { accountId: account.id, symbol, side, qty, price, gross, commission, estimatedNet };
}

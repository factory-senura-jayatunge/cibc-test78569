import { getAccount } from '../../platform/accounts.js';
import { assetClassOf, getPrice } from '../../platform/pricing.js';
import { roundRatio } from '../../platform/money.js';

export const MANDATES = {
  'balanced-income': {
    label: 'Balanced Income',
    targets: { equity: 0.5, 'fixed-income': 0.4, cash: 0.1 },
    driftTolerance: 0.05,
  },
  growth: {
    label: 'Growth',
    targets: { equity: 0.75, 'fixed-income': 0.2, cash: 0.05 },
    driftTolerance: 0.05,
  },
};

export function allocation(account) {
  const totals = { equity: 0, 'fixed-income': 0, cash: account.cash ?? 0 };
  for (const position of account.positions ?? []) {
    totals[assetClassOf(position.symbol)] += position.qty * getPrice(position.symbol);
  }
  const grand = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(totals).map(([assetClass, value]) => [assetClass, roundRatio(value / grand)]));
}

export function driftReport(accountId) {
  const account = getAccount(accountId);
  const mandate = MANDATES[account.mandate];
  if (!mandate) {
    const error = new Error(`Account ${accountId} has no discretionary mandate`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  const actual = allocation(account);
  const rows = Object.entries(mandate.targets).map(([assetClass, target]) => ({
    assetClass,
    target,
    actual: actual[assetClass],
    drift: roundRatio(actual[assetClass] - target),
  }));
  const needsRebalance = rows.some((row) => Math.abs(row.drift) > mandate.driftTolerance);
  return { accountId: account.id, mandate: mandate.label, rows, needsRebalance };
}

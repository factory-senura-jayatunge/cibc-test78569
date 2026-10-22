import { FEE_SCHEDULES, tieredAnnualFee } from '../../platform/fees.js';
import { marketValue } from '../../platform/pricing.js';
import { roundCents } from '../../platform/money.js';

export function householdAssets(account) {
  return roundCents((account.cash ?? 0) + marketValue(account.positions));
}

export function annualAdvisoryFee(account) {
  return tieredAnnualFee(householdAssets(account), FEE_SCHEDULES['wood-gundy'].tiers);
}

export function advisoryFeeForQuarter(account) {
  return roundCents(annualAdvisoryFee(account) / 4);
}

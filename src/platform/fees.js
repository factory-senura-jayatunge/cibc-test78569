import { roundCents } from './money.js';

export const FEE_SCHEDULES = {
  'investors-edge': { commissionPerTrade: 6.95, activeTraderCommission: 4.95, activeTraderThreshold: 30 },
  'wood-gundy': {
    tiers: [
      { upTo: 250000, rate: 0.015 },
      { upTo: 1000000, rate: 0.0125 },
      { upTo: Infinity, rate: 0.01 },
    ],
  },
  pic: { managementRate: 0.0095 },
  'private-banking': { annualServiceFee: 1200 },
};

export function tieredAnnualFee(assets, tiers) {
  if (!(assets >= 0)) throw new RangeError('assets must be a non-negative number');
  let remaining = assets;
  let lowerBound = 0;
  let fee = 0;
  for (const tier of tiers) {
    const band = Math.min(remaining, tier.upTo - lowerBound);
    if (band <= 0) break;
    fee += band * tier.rate;
    remaining -= band;
    lowerBound = tier.upTo;
  }
  return roundCents(fee);
}

export function commissionFor(tradesThisQuarter) {
  const schedule = FEE_SCHEDULES['investors-edge'];
  return tradesThisQuarter >= schedule.activeTraderThreshold
    ? schedule.activeTraderCommission
    : schedule.commissionPerTrade;
}

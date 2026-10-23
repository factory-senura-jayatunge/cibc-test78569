import { roundCents } from './money.js';

const PRICES = {
  'NSE-CDNEQ': { price: 38.42, assetClass: 'equity', name: 'Northshore Canadian Equity Index' },
  'NSE-USEQ': { price: 61.15, assetClass: 'equity', name: 'Northshore US Equity Index' },
  'NSE-AGGBD': { price: 9.87, assetClass: 'fixed-income', name: 'Northshore Aggregate Bond' },
};

function lookup(symbol) {
  const quote = PRICES[symbol];
  if (!quote) {
    const error = new Error(`Unknown symbol ${symbol}`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  return quote;
}

export function getPrice(symbol) {
  return lookup(symbol).price;
}

export function assetClassOf(symbol) {
  return lookup(symbol).assetClass;
}

export function marketValue(positions = []) {
  return roundCents(positions.reduce((sum, position) => sum + position.qty * getPrice(position.symbol), 0));
}

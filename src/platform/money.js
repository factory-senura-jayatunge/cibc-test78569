export function roundCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundRatio(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

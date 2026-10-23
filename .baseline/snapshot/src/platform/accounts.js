// Synthetic client book. Every name, number and balance is fictional.
const ACCOUNTS = [
  {
    id: 'IE-58210043',
    lob: 'investors-edge',
    holder: 'Avery Tremblay',
    type: 'TFSA',
    cash: 12450,
    positions: [
      { symbol: 'NSE-CDNEQ', qty: 300 },
      { symbol: 'NSE-AGGBD', qty: 500 },
    ],
    tradesThisQuarter: 14,
  },
  {
    id: 'IE-58210077',
    lob: 'investors-edge',
    holder: 'Jordan Lefebvre',
    type: 'Margin',
    cash: 4100,
    positions: [
      { symbol: 'NSE-USEQ', qty: 800 },
      { symbol: 'NSE-CDNEQ', qty: 1200 },
    ],
    tradesThisQuarter: 37,
  },
  {
    id: 'WG-30115520',
    lob: 'wood-gundy',
    holder: 'Meera Singh',
    type: 'Fee-based advisory',
    advisor: 'R. Okafor',
    cash: 28000,
    positions: [
      { symbol: 'NSE-CDNEQ', qty: 2500 },
      { symbol: 'NSE-USEQ', qty: 1800 },
      { symbol: 'NSE-AGGBD', qty: 4000 },
    ],
  },
  {
    id: 'PIC-77004101',
    lob: 'pic',
    holder: 'Harcourt Family Trust',
    type: 'Discretionary',
    mandate: 'balanced-income',
    cash: 150000,
    positions: [
      { symbol: 'NSE-CDNEQ', qty: 9000 },
      { symbol: 'NSE-USEQ', qty: 6000 },
      { symbol: 'NSE-AGGBD', qty: 30000 },
    ],
  },
  {
    id: 'PB-12003885',
    lob: 'private-banking',
    holder: 'Daniel Osei',
    type: 'Secured line of credit',
    cash: 8200,
    creditLimit: 120000,
    drawn: 52000,
    collateralAccount: 'IE-58210077',
  },
];

export function listAccounts(lob) {
  return ACCOUNTS.filter((account) => !lob || account.lob === lob).map((account) => structuredClone(account));
}

export function getAccount(id) {
  const account = ACCOUNTS.find((candidate) => candidate.id === id);
  if (!account) {
    const error = new Error(`Unknown account ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  return structuredClone(account);
}

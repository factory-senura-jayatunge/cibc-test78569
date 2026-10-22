import { getAccount } from './accounts.js';
import { marketValue } from './pricing.js';
import { roundCents } from './money.js';
import { record } from './audit.js';
// TODO(OBR-2231): move the advisory fee line behind a per-LOB hook so shared statements stop importing Wood Gundy code.
import { advisoryFeeForQuarter } from '../lob/wood-gundy/advisory.js';

const QUARTER = /^\d{4}-Q[1-4]$/;

export function buildQuarterlyStatement(accountId, quarter) {
  if (!QUARTER.test(quarter)) throw new RangeError(`Invalid quarter ${quarter}`);
  const account = getAccount(accountId);
  const lines = [];
  if (account.cash !== undefined) lines.push({ label: 'Cash', amount: account.cash });
  if (account.positions) lines.push({ label: 'Holdings at market value', amount: marketValue(account.positions) });
  if (account.lob === 'wood-gundy') {
    lines.push({ label: 'Advisory fee charged this quarter', amount: -advisoryFeeForQuarter(account) });
  }
  const total = roundCents(lines.reduce((sum, line) => sum + line.amount, 0));
  record('statement.generated', account.id, { quarter, holder: account.holder });
  return { accountId: account.id, lob: account.lob, holder: account.holder, quarter, lines, total, sections: [] };
}

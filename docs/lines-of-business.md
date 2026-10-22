# Lines of business

Each line of business owns one folder under `src/lob/`, its regression suites, and its statement section. Its `index.js` is the only file the API calls.

## Investor's Edge

Self-directed online brokerage.

| | |
| --- | --- |
| Module | `src/lob/investors-edge/` |
| Public surface | `previewOrder`, `positionsValue`, `statementFor` |
| Accounts | `IE-58210043` (TFSA), `IE-58210077` (Margin) |
| Suites | `ie-trading` (180 min), `ie-statements` (75 min) |

**Order preview** (`trading.js`). `previewOrder({ accountId, symbol, side, qty })` validates an order without placing it:

- Only Investor's Edge accounts can place orders.
- `side` is `buy` or `sell`, and `qty` is a positive integer.
- A buy must be covered by cash, including commission.
- A sell cannot exceed the position held.

It returns the price, the gross amount, the commission, and the estimated net amount. Each preview writes an `order.previewed` audit event.

**Commissions.** $6.95 per trade, or $4.95 for active traders with 30 or more trades in the quarter.

**Statement section: Trading activity.** Trades this quarter, and commission per trade.

## Wood Gundy

Full-service, fee-based advisory.

| | |
| --- | --- |
| Module | `src/lob/wood-gundy/` |
| Public surface | `statementFor` (fee functions in `advisory.js`) |
| Accounts | `WG-30115520` (Fee-based advisory) |
| Suites | `wg-advisory` (120 min), `wg-statements` (90 min) |

**Advisory fees** (`advisory.js`). Fees are charged on household assets (cash plus holdings at market value), in marginal tiers:

| Household assets | Annual rate |
| --- | --- |
| Up to $250,000 | 1.50% |
| $250,000 to $1,000,000 | 1.25% |
| Above $1,000,000 | 1.00% |

The quarterly fee is one quarter of the annual fee. The shared statement builder deducts it as "Advisory fee charged this quarter". That deduction is why `src/platform/statements.js` imports `advisory.js` (OBR-2231).

**Statement section: Advisory relationship.**

| Row | Source |
| --- | --- |
| Advisor | Account record |
| Household assets | `householdAssets` |
| Annual advisory fee (projected) | `annualAdvisoryFee` |
| Effective annual advisory fee rate (bps) | Annual fee divided by household assets, in basis points to one decimal (WG-1042) |
| Advisory fees, trailing four quarters | Four times the current quarter's fee (WG-1042) |

## PIC

Discretionary portfolio management against a mandate.

| | |
| --- | --- |
| Module | `src/lob/pic/` |
| Public surface | `driftReport`, `statementFor` |
| Accounts | `PIC-77004101` (Discretionary, Balanced Income) |
| Suites | `pic-mandates` (120 min), `pic-statements` (75 min) |

**Mandates** (`mandates.js`):

| Mandate | Equity | Fixed income | Cash | Drift tolerance |
| --- | --- | --- | --- | --- |
| Balanced Income | 50% | 40% | 10% | ±5 points |
| Growth | 75% | 20% | 5% | ±5 points |

`driftReport(accountId)` compares actual allocation with the mandate target for each asset class. It recommends a rebalance when any class drifts beyond tolerance. The management fee schedule is 0.95% a year.

**Statement section: Discretionary mandate.** The mandate, actual allocation against target per asset class, and whether a rebalance is recommended.

## Private Banking

Secured lines of credit against an investment portfolio.

| | |
| --- | --- |
| Module | `src/lob/private-banking/` |
| Public surface | `creditSummary`, `statementFor` |
| Accounts | `PB-12003885` (Secured line of credit, collateral `IE-58210077`) |
| Suites | `pb-credit` (120 min), `pb-statements` (60 min) |

**Credit summary** (`credit.js`). Limit, drawn, available, the collateral account, and the loan-to-value ratio. Loan-to-value is the drawn amount divided by the collateral account's market value, rounded with `roundRatio`. Collateral is valued through Investor's Edge `positionsValue`, which is known debt (see [architecture.md](architecture.md#known-debt)).

**Loan-to-value status** (PB-2210). `ltvStatus(ratio)` gives relationship managers an early warning before a margin call:

| Loan-to-value | Status |
| --- | --- |
| Below 0.60 | `ok` |
| 0.60 to 0.70 inclusive | `watch` |
| Above 0.70, or no collateral value | `margin-call-warning` |

**Fees.** $1,200 annual service fee.

**Statement section: Credit facility.**

| Row | Source |
| --- | --- |
| Limit, Drawn, Available | `creditSummary` |
| Loan-to-value | `loanToValue` |
| LTV status | `ltvStatus` (PB-2210) |
| Annual service fee | Fee schedule |

## Shared platform

Owned by the platform team. A change here widens regression to every line of business, so plans must call it out and justify it.

| Module | Suite |
| --- | --- |
| `accounts.js` | `platform-accounts` (45 min) |
| `pricing.js` | `platform-pricing` (45 min) |
| `fees.js`, `money.js` | `platform-fees` (90 min) |
| `audit.js` | `platform-audit` (30 min) |
| `statements.js` | Every `*-statements` suite |
| `server.js` | `smoke` (30 min, always runs) |

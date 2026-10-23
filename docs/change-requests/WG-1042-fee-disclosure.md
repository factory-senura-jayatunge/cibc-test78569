# WG-1042: Annual fee disclosure on Wood Gundy quarterly statements

**Line of business:** Wood Gundy (fee-based advisory)
**Requested by:** Client Reporting, on behalf of Compliance
**Target release:** next scheduled release

## Why

Client-reporting rules (CRM2-style) require fee-based advisory clients to see what they pay in dollars and as a rate. Today the Wood Gundy statement shows the quarter's fee and a projected annual fee, but no trailing total and no effective rate.

## Acceptance criteria

1. **AC1:** The Wood Gundy statement's "Advisory relationship" section shows a row labelled `Effective annual advisory fee rate (bps)`. The value is the annual advisory fee divided by household assets, in basis points, rounded to one decimal. For account `WG-30115520` it is `147.8`.
2. **AC2:** The same section shows `Advisory fees, trailing four quarters` in dollars. In this synthetic model, use four times the current quarter's fee. For `WG-30115520` it is `4045`.
3. **AC3:** Statements for Investor's Edge, PIC, and Private Banking do not change.
4. **AC4:** Every criterion has a test that would fail if the behaviour were removed. New test files are registered in `regression/catalog.json`.

## Constraints

- Keep the change inside the Wood Gundy boundary (`src/lob/wood-gundy/`) where possible. Changes to `src/platform/` widen regression scope for every line of business.
- Money and ratios go through `src/platform/money.js` helpers.

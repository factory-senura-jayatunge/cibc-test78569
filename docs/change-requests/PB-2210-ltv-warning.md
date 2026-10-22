# PB-2210: Loan-to-value early warning on secured credit lines

**Line of business:** Private Banking
**Requested by:** Credit Risk
**Target release:** next scheduled release

## Why

Relationship managers find out about collateral shortfalls too late. The credit summary should classify loan-to-value (LTV) so a manager sees a warning before a margin call.

## Acceptance criteria

1. **AC1:** `creditSummary` returns `ltvStatus`: `ok` below 0.60, `watch` from 0.60 to 0.70 inclusive, `margin-call-warning` above 0.70.
2. **AC2:** The Private Banking statement's "Credit facility" section shows an `LTV status` row.
3. **AC3:** Statements for other lines of business do not change.
4. **AC4:** Boundary values (0.6, 0.7, just above 0.7) are tested.

## Constraints

- Keep the change inside `src/lob/private-banking/`.

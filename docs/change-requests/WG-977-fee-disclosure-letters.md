# WG-977: Advisory fee disclosure letters for Wood Gundy clients

**Line of business:** Wood Gundy (fee-based advisory)
**Requested by:** Client Reporting, on behalf of Compliance
**Target release:** 2026.10

## Why

Fee-based advisory clients see the quarter's advisory fee on their statement, but Compliance also needs a standalone disclosure letter that states the household assets and the projected annual advisory fee in dollars. Two letters are catalogued (the annual disclosure and a fee-schedule change notice), and relationship managers can render an ad-hoc draft letter from their own template body.

## Acceptance criteria

1. **AC1:** `POST /api/advisory/:accountId/fee-disclosure` renders the catalogued `annual-fee-disclosure` and `fee-change-notice` letters for a Wood Gundy account, interpolating the holder, account number, advisor, household assets, and projected annual fee (`4045` for `WG-30115520`).
2. **AC2:** A `draft` in the request body renders from its own lodash template source and may set the lodash `variable` option that names the data object inside the template.
3. **AC3:** Non-Wood Gundy accounts return 400, unknown accounts and unknown template IDs return 404, and a draft without a source returns 400.
4. **AC4:** Rendering writes an `advisory.fee-disclosure.rendered` audit event with the account number masked and no client name in the detail.
5. **AC5:** Both catalogued letters and their template settings are covered by tests, and the suite is registered in `regression/catalog.json` as `wg-disclosure`.

## Constraints

- lodash is the rendering engine. This change request introduces it as the platform's one runtime dependency and owns it.
- Keep the change inside `src/lob/wood-gundy/`, apart from the route in `src/server.js`.
- Money figures go through the existing advisory fee helpers; no new rounding logic.

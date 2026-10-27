---
name: qa-api
description: >-
  curl QA for the OBR HTTP API: all eight routes, request IDs, metrics, and error mapping. Use when anything under src/ changes. NOT for portal UI testing (use qa-web).
metadata:
  version: '1.0.0'
---

# QA: OBR HTTP API

Eight JSON routes served by `src/server.js` from a fixed route table, on top of `src/platform/` (accounts, pricing, fees, money, audit, statements) and four `src/lob/` modules. No authentication, no persistence: POST bodies are pure computations. Synthetic fixtures live in `src/platform/accounts.js` (5 accounts). Prometheus metrics at `/api/metrics`. The contract of record is `docs/api.md` and `docs/openapi.yaml`.

## Testing Target

Same server as the portal. In CI the workflow starts it from the checked-out branch code: verify `curl -fsS http://localhost:3000/api/health` and reuse it. Locally, do not reuse a server you did not start in this run (a healthy health check does not prove which checkout is serving); start a fresh `npm start` from the repo root and poll `/api/health` until `{"status":"ok"}`, setting another `PORT` if 3000 is busy. No credentials or env vars are needed; `PORT`, `LOG_LEVEL`, and `AUDIT_STDOUT` are optional (see `.env.example`). Never fall back to a remote environment; if the server cannot start, report ALL API tests as BLOCKED with the startup error.

## Test flow menu

NOT a checklist: the orchestrator picks flows relevant to the diff, plus adjacent integration flows, and writes ad-hoc tests for uncovered changes. Fixtures: IE `IE-58210043` (Avery Tremblay, TFSA), IE `IE-58210077` (Jordan Lefebvre, Margin), WG `WG-30115520` (Meera Singh, fee-based advisory, advisor R. Okafor), PIC `PIC-77004101` (Harcourt Family Trust, balanced-income mandate), PB `PB-12003885` (Daniel Osei, secured line of credit, collateral `IE-58210077`).

### 1. Health and request IDs

`curl -i http://localhost:3000/api/health` -> `200`, body `{"status":"ok"}`, and an `X-Request-ID` response header. Send `X-Request-ID: qa-run-001` -> the same value is echoed (safe ids are 1-128 chars of letters, digits, `.`, `_`, `:`, `-`); send an unsafe value (spaces) -> a generated UUID comes back.

### 2. Accounts list and filter

`curl http://localhost:3000/api/accounts` -> 5 summaries (`id`, `lob`, `holder`, `type` only). `?lob=wood-gundy` -> exactly 1 (WG-30115520, Meera Singh). `?lob=private-banking` -> exactly 1 (PB-12003885, Daniel Osei). Quirk: an unknown `lob` value returns `200` with an empty `accounts` array, not an error.

### 3. Quarterly statements

`curl http://localhost:3000/api/statements/WG-30115520?quarter=2026-Q3` -> statement with `holder` Meera Singh, `quarter` 2026-Q3, `lines` (Cash 28000, Holdings at market value 245600, Advisory fee charged this quarter -1011.25), `total` 272588.75, and an "Advisory relationship" section. Omitted `quarter` defaults to 2026-Q3. Unknown account -> `404` `{"error":"Unknown account XX"}`. Each LOB's account returns its own sections (advisory relationship for WG, trading activity for IE, mandate detail for PIC, credit detail for PB).

### 4. Order preview (Investor's Edge)

`POST /api/orders/preview` (content-type application/json) with `{"accountId":"IE-58210043","symbol":"NSE-CDNEQ","side":"buy","qty":10}` -> `order` with `price` 38.42, `gross` 384.2, `commission` 6.95, `estimatedNet` 391.15. Nothing is placed. Negatives: `qty: 0` -> `400` `{"error":"qty must be a positive integer"}`; malformed JSON -> `400`; unknown account -> `404`.

### 5. Credit facility (Private Banking)

`GET /api/credit/PB-12003885` -> `limit` 120000, `drawn` 52000, `available` 68000, `collateralAccount` IE-58210077, `loanToValue` 0.5472, `ltvStatus` "ok". Thresholds: `ok` below 0.60, `watch` from 0.60 to 0.70 inclusive, `margin-call-warning` above 0.70 (change request PB-2210). A non-PB account (e.g. WG-30115520) -> `400`; unknown account -> `404`.

### 6. Advisory fee disclosure (Wood Gundy, WG-977)

`POST /api/advisory/WG-30115520/fee-disclosure` with `{"templateId":"annual-fee-disclosure"}` -> `letter` titled "Annual advisory fee disclosure", body opens "Dear Meera Singh," and names advisor R. Okafor. Second catalogued template: `fee-change-notice`. Draft letters: `{"draft":{"title":"Ad-hoc fee note","source":"Fee <%- letter.annualFee %> CAD for <%- letter.holder %>","variable":"letter"}}` -> body "Fee 4045 CAD for Meera Singh"; `variable` names the data object inside the template source (catalogued templates use `letter`). A non-WG account -> `400`. Rendering writes an `advisory.fee-disclosure.rendered` audit event with the account masked (`WG-****5520`) and no client name -- with `AUDIT_STDOUT=1` the event is visible on server stdout; otherwise verify no unmasked ids or client names appear in request logs.

### 7. Mandate drift (PIC)

`GET /api/mandates/PIC-77004101/drift` -> `mandate` "Balanced Income", three rows (equity target 0.5 / actual 0.615 / drift 0.115; fixed-income; cash), `needsRebalance` true. An account without a mandate (e.g. WG-30115520) -> `404`.

### 8. Prometheus metrics

`GET /api/metrics` -> Prometheus text: `http_requests_total` and `http_request_duration_seconds` labeled by route TEMPLATE (e.g. `route="/api/statements/:accountId"`), plus `process_uptime_seconds`. After exercising the flows above, counters for the used routes are greater than 0. Unmatched paths share `route="unmatched"`; portal files share `route="static"`. Account numbers never appear in metrics labels.

### 9. Error-status mapping (negative suite)

- Unknown API route (`/api/nope`) -> `404` `{"error":"Not found"}`.
- Unknown static path (`/nope`) -> `404` JSON, not an HTML error page.
- Wrong method (`DELETE /api/health`) -> `404`; the route table matches method plus path.
- Path traversal (`/../../etc/passwd` or encoded variants) -> `404`; `readStatic` normalizes and rejects paths outside `public/`.
- Any `500` body is exactly `{"error":"Internal error"}`; the real cause appears only in server stdout as a `request failed` JSON log line.

## Evidence

For each flow, embed a trimmed request/response pair as a fenced code block: the curl invocation, the status line, headers that matter (`X-Request-ID`), and the JSON body trimmed to the asserted fields. Label what it shows and why it matters. Never repeat identical output; each snapshot must show something different.

## Error handling

Never silently skip a flow. If the server is down or a flow cannot complete, report BLOCKED with the exact error and remediation. If a response deviates from the documented contract (`docs/api.md`, `docs/openapi.yaml`), that is a FAIL with the expected-vs-actual diff.

## Known Failure Modes

1. **The server must be started from the repo root** (`npm start`); it loads `.env` if present, and a `PORT` already set in the environment wins over `.env`.
2. **500s hide their cause.** The body is always "Internal error"; check server stdout (`request failed` lines) for the real error.
3. **Unknown `lob` filter values are not errors.** `200` with an empty list is correct behavior.
4. **Statements require `YYYY-Qn` quarters**; an invalid quarter returns `400`.
5. **`/api/accounts` returns summaries only** (`id`, `lob`, `holder`, `type`); cash, positions, and advisors are not in the response.
6. **Everything is JSON except `/api/metrics`** (Prometheus text format).

---
name: qa-web
description: >-
  Browser QA for the OBR portal: load, LOB navigation, accounts, and statement rendering via droid-control. Use when public/ or static serving changes. NOT for API testing (use qa-api).
metadata:
  version: '1.0.0'
---

# QA: OBR statement portal (web)

The portal is a vanilla-JS ES module (`public/app.js`, no build step, no framework) served at `/` by `src/server.js`. It has no authentication and no state: it fetches `/api/accounts?lob=<id>` and `/api/statements/:id?quarter=2026-Q3`, then renders with DOM APIs (`replaceChildren`). Synthetic data only.

## Testing Target

This repo has no preview deployments, so always test the branch's own code:

1. In CI, the workflow starts the server from the checked-out branch code: verify `curl -fsS http://localhost:3000/api/health` and reuse it.
2. Locally, do not reuse a server you did not start in this run (a healthy health check does not prove which checkout is serving). Start a fresh one from the repo root: `npm start` in the background, then poll `http://localhost:3000/api/health` until it returns `{"status":"ok"}`.
3. If port 3000 is busy, set `PORT` (in `.env` or the environment) and use that base URL for every portal test.

NEVER fall back to a remote environment -- none exist, and any other checkout runs different code. If the server cannot start, report ALL web tests as BLOCKED: "Dev server did not start -- cannot verify branch code," with the startup error.

## Authentication in CI

None. The portal and API are unauthenticated by design (SECURITY.md: localhost only). No env vars or credentials are needed for this app.

## Interactive testing with Droid Control

Use the `droid-control` skill for all browser interactions. Invoke it before touching the portal and follow its routing tables: the agent-browser driver owns browser mechanics, Capture owns snapshots and recordings, Verify owns assertions. This file describes WHAT to test; droid-control owns HOW to drive, capture, and verify. Load Compose only when both `video_evidence` and `droid_control.compose` are true in `.factory/skills/qa/config.yaml`; when either is false, keep raw captures and text snapshots as evidence.

When `imagemagick: true` in config, before/after screenshots of the same flow can be diffed into an animated GIF with `magick` for visual-regression evidence; store it under `./qa-results/$RUN_ID/`.

## Test flow menu

These are NOT a checklist. The orchestrator picks the flows relevant to the current diff, plus adjacent integration flows, and writes ad-hoc tests for anything uncovered.

### 1. Portal load

Load `/`. Verify: the synthetic-data banner ("Synthetic model built from discovery notes..."), the `OBR Online Brokerage & Reporting` header, `nav#lobs` with exactly four buttons (Investor's Edge, Wood Gundy, Private Investment Council, Private Banking), the accounts section auto-populated on load with the two Investor's Edge accounts (Avery Tremblay `IE-58210043` TFSA, Jordan Lefebvre `IE-58210077` Margin), and the statement placeholder "Select an account to render its 2026-Q3 statement."

Success: all elements present; the Investor's Edge nav button has `aria-pressed="true"`; no console errors.

### 2. LOB switch

Click each nav button and wait for the accounts section to change. Expected lists: Wood Gundy -> Meera Singh `WG-30115520` (Fee-based advisory); Private Investment Council -> Harcourt Family Trust `PIC-77004101` (Discretionary); Private Banking -> Daniel Osei `PB-12003885` (Secured line of credit). Investor's Edge returns both IE accounts.

Success: each click replaces the account list with exactly the expected accounts, and `aria-pressed="true"` moves to the clicked button (the active LOB is tracked by that attribute; there is no CSS class).

### 3. Statement render

Click an account (Meera Singh has the richest fixture). Wait for the statement section to replace its placeholder. Verify: heading `Meera Singh · 2026-Q3`, the account id line, the lines table (Cash, Holdings at market value, Advisory fee charged this quarter), the Total row, and the "Advisory relationship" section (Advisor `R. Okafor`, household assets, projected annual fee, effective annual advisory fee rate in bps).

Success: holder, quarter, total, and sections all render. Money values are CAD-formatted (`$28,000.00` style, en-CA); values whose label matches /trades|bps|target|loan-to-value/i are NOT currency-formatted (the bps rate renders raw, e.g. `147.8`).

### 4. Portal-API integration (adjacent flow)

The portal renders whatever the API returns, with no portal-side logic beyond formatting. When the diff changes `src/platform/accounts.js` fixtures or statement output, reload `/` and verify the change is visible with no `public/` changes (new account buttons, changed statement lines). If a statement fetch fails, the portal renders the API's `error` message as plain text in the statement section -- verify that path when the diff touches error shapes.

### 5. Money formatting edges (ad-hoc material)

`format()` in `public/app.js` currency-formats only numbers with `Math.abs(value) >= 1` whose label does not match the NOT_MONEY regex. If the diff touches formatting, test boundary values (0.5 vs 1, a `bps` row vs a `Cash` row) through a statement render.

## Persona

Every flow runs as the single `visitor` persona (anonymous). There are no roles, so there are no per-persona variations or permission negatives.

## Error handling

- Portal fails to load at all -> BLOCKED (dev server not running or crashed; include the server's stdout).
- A statement click renders an error paragraph -> that is the API error surfaced; capture it and judge FAIL/BLOCKED by whether the API error is expected from the diff.
- Never silently skip a flow. Report BLOCKED with what was tried and how to fix it.

## Known Failure Modes

1. **No `data-testid` attributes.** Select by accessible name and ARIA roles: `nav[aria-label="Lines of business"]`, `section[aria-label="Accounts"]`, `section[aria-label="Quarterly statement"]`, buttons by holder-name text.
2. **Account buttons show the holder name plus a `small` with `id · type`.** Match on the holder name; assert the id in the `small` text.
3. **The active LOB is tracked by `aria-pressed`, not a class.** Wait for the attribute to flip before capturing.
4. **The statement quarter is hardcoded `2026-Q3` in `public/app.js`.** The UI cannot request other quarters; quarter handling is API-only.
5. **Rendering is synchronous DOM replacement.** After a click, wait for the expected holder name or section text to appear before snapshotting; leftover placeholder text means the fetch has not resolved.
6. **`public/index.html` loads `/app.js` as `type=module`.** No build step and no cache busting: after `public/` changes, do a hard reload before asserting.

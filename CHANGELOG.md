# Changelog

Every change links to its change request and release note. Releases follow the `YYYY.MM` release train.

## [Unreleased]: 2026.11 release train

- **WG-1042** (#1): Wood Gundy statements show the effective annual advisory fee rate in basis points, and advisory fees for the trailing four quarters. [Release note](docs/releases/WG-1042.md)
- **PB-2210** (#2): Private Banking credit summaries and statements classify loan-to-value as `ok`, `watch`, or `margin-call-warning`. [Release note](docs/releases/PB-2210.md)
- **Tooling:** quality gates (`npm run check`: ESLint with module-boundary, complexity, and size rules; Prettier; strict opt-in type checking; knip; jscpd; docs drift; file size; coverage thresholds) in CI and a pre-commit hook. Structured, scrubbed request logs with `X-Request-ID`, `GET /api/metrics`, and `npm run profile`. Flaky-suite detection and failure issues for the nightly regression. CodeQL, ZAP baseline, Droid review, and Dependabot workflows. OpenAPI schema, runbooks, a dev container, and agent skills. No change to line-of-business or platform behavior. API routes now match their full path, so trailing extra segments (for example `/api/credit/PB-12003885/x`) return 404 instead of being ignored. [Release note](docs/releases/READINESS-1.md)
- **Tooling review fixes** (follow-up to #3): account numbers next to `_` or digits are now masked in logs, the file-size check handles quoted Git paths and measures staged blobs, `npm run profile` stops its server on failure, and `npm start` loads `.env`. [Release note](docs/releases/READINESS-1.md)

## 2026.10: release baseline

The state recorded in `.baseline/` as the last release.

- **Platform:** synthetic account book, pricing for three index funds, fee schedules, money rounding helpers, in-memory audit log, and the quarterly statement builder.
- **Investor's Edge:** order preview with cash and position checks, and active-trader commission pricing.
- **Wood Gundy:** tiered advisory fees, and the advisory relationship section on statements.
- **PIC:** Balanced Income and Growth mandates, allocation drift, and rebalance signals.
- **Private Banking:** secured line of credit summary with loan-to-value.
- **Delivery tooling:** 13-suite regression catalogue (18 h production-equivalent), change-impact analysis, scoped regression runner, coupling report, and release pack.

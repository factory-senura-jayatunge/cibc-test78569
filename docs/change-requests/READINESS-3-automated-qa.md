# READINESS-3: Automated functional QA

**Line of business:** None (delivery tooling)
**Requested by:** Release engineering
**Target release:** 2026.11

## Why

CI proves the gates (lint, types, coverage, scoped regression), but nothing exercises the running application the way a reviewer would: click the portal, call the API, and check the documented contract against the branch's actual behavior. The DAST workflow scans for vulnerabilities, not functional correctness, so portal and API behavior is verified by hand or not at all.

## Acceptance criteria

1. **AC1:** A `qa` orchestrator skill maps the changed files in a git diff to the affected apps (portal: `public/**` and `src/server.js`; API: `src/**`) using the path patterns in `.factory/skills/qa/config.yaml`, and reports INCONCLUSIVE when no app code changed.
2. **AC2:** A `qa-web` sub-skill drives the statement portal through droid-control (agent-browser) with a menu of flows: portal load, LOB switch, statement render, portal-API integration, and money-formatting edges.
3. **AC3:** A `qa-api` sub-skill exercises all eight API routes plus request-ID, metrics, and error-status behavior through curl, including negative cases (unknown account, invalid order, wrong account type, path traversal).
4. **AC4:** A QA workflow starts the dev server from the checked-out branch code on the runner, runs the `qa` skill through `droid exec`, uploads `qa-results/` as artifacts, and posts or updates exactly one sticky PR comment per PR marked `<!-- qa-report -->`. It is informational only and does not block merge.
5. **AC5:** `.factory/settings.json` enables `droid-control@factory-plugins` at project scope so interactive flows have a driver, and `qa-results/` is gitignored.

## Constraints

- QA never runs the repository's own suites (`npm test`, `npm run check`, `npm run regression:*`); those belong to CI.
- The check is informational: branch protection must not require it.
- No line-of-business or platform code changes; no new runtime dependencies.
- Evidence is text-first (accessibility-tree snapshots, trimmed curl request/response pairs); video evidence stays off by default.

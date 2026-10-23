# READINESS-2: Dependency-aware impact analysis and dependency security scanning

**Line of business:** None (delivery tooling)
**Requested by:** Release engineering
**Target release:** 2026.11

## Why

Since WG-977 the application has a runtime dependency, and the tooling has two blind spots. Impact analysis only follows the source import graph, so a `package.json` bump selected nothing beyond the smoke suite. And nothing turns `npm audit` results into code-scanning alerts, so a vulnerable dependency can sit on `main` without a tracked finding.

## Acceptance criteria

1. **AC1:** Import specifiers resolve to their package root (`lodash/template.js` → `lodash`, scoped packages keep both segments, relative and `node:` imports are ignored).
2. **AC2:** Manifest diffs report added, removed, and re-versioned dependencies only, across `dependencies` and `devDependencies`.
3. **AC3:** The import graph maps a package to the source files that import it (`lodash` → `src/lob/wood-gundy/disclosure.js`).
4. **AC4:** A `package.json` or `package-lock.json` change scopes regression to the suites covering the changed packages' importers: for lodash that is `smoke`, `wg-disclosure`, and `wg-statements`. When no before-state exists (`--files` predictions), every declared dependency counts as changed.
5. **AC5:** `scripts/audit-to-sarif.js` converts `npm audit --json` to SARIF 2.1.0 with one rule per advisory and severity-mapped levels.
6. **AC6:** A Security scan workflow runs `npm audit`, converts the report, and uploads the SARIF to code scanning on pull requests, pushes to `main`, and weekly. Findings are archived under `security/findings/`.

## Constraints

- The new suite (`tooling-impact`) has `productionMinutes: 0` and owner `release-engineering`; the catalogue stays at 18 production-equivalent hours.
- The baseline records `package.json` and `package-lock.json` hashes so baseline-mode impact analysis can see manifest changes.
- No fixes to flagged dependencies in this change; findings are tracked, not resolved.

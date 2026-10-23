# Release note: READINESS-2, dependency-aware impact analysis and dependency security scanning

**Line of business:** None (delivery tooling)
**Files changed:** `scripts/lib/dependencies.js` (new), `scripts/lib/graph.js`, `scripts/impact.js`, `scripts/baseline.js`, `scripts/audit-to-sarif.js` (new), `tests/tooling-impact.test.js` (new), `regression/catalog.json`, `.github/workflows/security-scan.yml` (new), `security/findings/2026-10-22-sca.sarif`, `security/findings/2026-10-22-sca.md`, docs

## Summary

Impact analysis is now dependency-aware. When `package.json` or `package-lock.json` changes, the changed packages are diffed against the previous manifest (the Git base ref, the release baseline snapshot, or every declared dependency for a `--files` prediction), and each changed package seeds the import-graph walk with the source files that import it. A lodash bump now scopes regression to `smoke`, `wg-disclosure`, and `wg-statements` (3.0 h) instead of looking unrelated to the graph. The baseline manifest records the two manifest files so baseline mode sees them.

A new Security scan workflow runs `npm audit --json`, converts it to SARIF 2.1.0 with `scripts/audit-to-sarif.js`, and uploads it with `github/codeql-action/upload-sarif`, so dependency advisories land in the repository's code-scanning alerts. The 2026-10-22 scan is archived under `security/findings/`. The new `tooling-impact` suite (0 production minutes, owner release-engineering) covers the changed scripts; the catalogue is now 15 suites and still 18 production-equivalent hours.

## Acceptance criteria to tests

| Criterion | Test | Result |
| --- | --- | --- |
| AC1: specifier to package root | `tests/tooling-impact.test.js` › `READINESS-2 AC1: import specifiers resolve to their package root` | PASS |
| AC2: manifest diff | `tests/tooling-impact.test.js` › `READINESS-2 AC2: manifest diffs report added, removed, and re-versioned dependencies only` | PASS |
| AC3: package to importers | `tests/tooling-impact.test.js` › `READINESS-2 AC3: the import graph maps a package to the source files that import it` | PASS |
| AC4: manifest change scopes regression | `tests/tooling-impact.test.js` › `READINESS-2 AC4: a manifest change scopes regression to smoke, wg-disclosure, and wg-statements` | PASS |
| AC5: audit to SARIF | `tests/tooling-impact.test.js` › `READINESS-2 AC5: npm audit JSON converts to SARIF with one rule per advisory`, `READINESS-2 AC5: advisory severities map to SARIF levels` | PASS |
| AC6: Security scan workflow | `.github/workflows/security-scan.yml`; verified by the workflow run on this pull request and the archived `security/findings/2026-10-22-sca.sarif` | PASS |

## Change impact

Compared against: `git diff origin/main` (CI mode).

**Regression scope:** 4 of 15 suites (smoke, wg-disclosure, wg-statements, tooling-impact), 3.0 h of 18.0 h production-equivalent (83% less than full regression). The pull request also carries the WG-977 files, which is what pulls the Wood Gundy suites in; tooling-only follow-ups scope to `smoke` and `tooling-impact`.

## Scoped regression result

**Scoped regression (`npm run regression:scoped`):** all selected suites passed. `npm test`: 88 of 88 passed. Full regression still runs nightly.

## Risks

- The SCA findings (CVE-2021-23337, CVE-2020-28500 against lodash 4.17.20) are deliberately not fixed here; the lodash upgrade is its own change request. (Known, tracked in `security/findings/2026-10-22-sca.md`.)
- `--files` predictions treat every declared dependency as changed because there is no before-state to diff. That is the widest safe scope for prediction, and CI (`--base`) is exact. (Low.)
- `npm audit` needs network access to the registry advisory database; the workflow fails open by still uploading an empty SARIF run. (Low.)

## Rollback

Revert the merge commit, or restore `scripts/impact.js`, `scripts/baseline.js`, `scripts/lib/graph.js`, and `regression/catalog.json` from `.baseline/snapshot/` and delete the new files. The workflow is additive; deleting it stops the scans. No data, schema, or configuration changes are involved.

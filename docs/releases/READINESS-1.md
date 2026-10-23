# Release note: READINESS-1, agent-readiness tooling and review fixes

**Change request:** [READINESS-1](../change-requests/READINESS-1-agent-readiness-tooling.md)
**Line of business:** none (delivery tooling, observability, and CI)
**Pull requests:** #3 (readiness tooling, merged as `b6ab9bb`) and its review follow-up
**Files changed:** 47, listed under Change impact. No file under `src/platform/` or `src/lob/` changed.

## Summary

Pull request #3 applied `/readiness-fix` to the Agent Readiness report `f3657cf2`. It added quality gates (`npm run check`: ESLint with boundary, complexity and size rules, Prettier, strict opt-in type checking, knip, jscpd, docs drift, file size, and coverage thresholds) in CI and a pre-commit hook. It also added structured, scrubbed request logs with `X-Request-ID`, `GET /api/metrics`, `npm run profile`, flaky-suite detection, nightly failure issues, CodeQL, a ZAP baseline scan, Droid review, Dependabot, an OpenAPI schema, runbooks, a dev container, and agent skills.

The Droid review of #3 posted 13 findings. The follow-up fixes them:

- **Account numbers in logs:** masking no longer relies on word boundaries, so an account number next to `_` or a digit, such as the request ID `request_WG-30115520`, is masked. The duplicate masking pass and the unread `Logger.level` property are removed.
- **File-size check:** Git paths are read NUL-delimited, so names Git would quote (non-ASCII, tabs, newlines) are measured. `--staged` measures the staged blob, not the working copy.
- **Profiler:** the API child process is stopped when a request fails, not only on success.
- **`.env`:** `npm start` now loads `.env` if it exists. Variables already set in the shell take precedence.
- **Cleanup:** `flagValue` reads `process.argv` itself, `createServer` builds its own metrics, route handlers no longer carry an unused `status`, and `out/regression.json` no longer repeats the flaky suite IDs at the top level (the nightly workflow reads `flaky: true` from each result).

One finding was not applied as suggested. The review proposed removing the CI `Unit and API tests` job because the quality job's `test:coverage` runs the same tests. The job is kept, with a comment, because it is the only CI check that `npm test` still runs with no install step, which AGENTS.md promises.

## Acceptance criteria to tests

| Criterion | Test | Result |
| --- | --- | --- |
| AC1: account numbers are masked next to underscores and other word characters, including in request logs | `tests/smoke.test.js` › `READINESS-1 AC1: account numbers are masked next to underscores and other word characters` | PASS |
| AC2: the file-size check measures files whose names Git would quote | `tests/smoke.test.js` › `READINESS-1 AC2: the file-size check measures files whose names Git would quote` | PASS |
| AC3: `--staged` measures the staged blob, not the working copy | `tests/smoke.test.js` › `READINESS-1 AC3: --staged measures the staged blob, not the working copy` | PASS |
| AC4: `.env` is loaded without overriding the environment | `tests/smoke.test.js` › `READINESS-1 AC4: loadLocalEnv reads .env without overriding the environment` | PASS |

Mutation checks: the previous masking regex leaves `request_WG-30115520` and `WG-30115520_retry` unmasked, and `git ls-files` without `-z` returns `"r\303\251sum\303\251.bin"`, which does not exist on disk. Both would fail AC1 and AC2. The profiler fix has no automated test; `npm run profile` was run after the change and still writes a profile.

## Change impact

Compared against: git diff 56b308e

**Changed files (47)**
- `.devcontainer/devcontainer.json`
- `.env.example`
- `.factory/skills/add-api-endpoint/SKILL.md`
- `.factory/skills/run-quality-gates/SKILL.md`
- `.github/ISSUE_TEMPLATE/bug-report.yml`
- `.github/ISSUE_TEMPLATE/change-request.yml`
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/dast.yml`
- `.github/workflows/droid-review.yml`
- `.github/workflows/nightly-regression.yml`
- `.gitignore`
- `.husky/pre-commit`
- `.jscpd.json`
- `.prettierignore`
- `.prettierrc.json`
- `AGENTS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `README.md`
- `SECURITY.md`
- `docs/api.md`
- `docs/openapi.yaml`
- `docs/regression.md`
- `docs/runbooks/README.md`
- `eslint.config.js`
- `knip.jsonc`
- `package-lock.json`
- `package.json`
- `regression/catalog.json`
- `scripts/baseline.js`
- `scripts/check-docs.js`
- `scripts/check-file-size.js`
- `scripts/coupling.js`
- `scripts/impact.js`
- `scripts/lib/cli.js`
- `scripts/lib/graph.js`
- `scripts/profile.js`
- `scripts/regression.js`
- `scripts/release-pack.js`
- `src/observability/logger.js`
- `src/observability/metrics.js`
- `src/observability/request-context.js`
- `src/server.js`
- `tests/smoke.test.js`
- `tsconfig.json`

**Lines of business affected:** none

**Regression scope:** 1 of 13 suites, 0.5 h of 18.0 h production-equivalent (97% less than full regression)

| Suite | Owner | Est. prod time | Why it runs |
| --- | --- | --- | --- |
| smoke | platform | 30 min | src/server.js changed (suite updated) |

Skipped: platform-accounts, platform-pricing, platform-fees, platform-audit, ie-trading, ie-statements, wg-advisory, wg-statements, pic-mandates, pic-statements, pb-credit, pb-statements

## Scoped regression result

**Scoped regression (`npm run regression:scoped`):** 1 of 1 suites passed (smoke), 0.5 h of 18.0 h production-equivalent. `npm test`: 70 of 70 passed. `npm run check`: passed (coverage 97.6% lines, 87.2% branches, 94.3% functions).

## Risks

- `GET /api/*` routes now match the full path, so a trailing extra segment (for example `/api/credit/PB-12003885/x`) returns 404 instead of being ignored. (Low, from #3.)
- Masking is now broader: any `AB-1234` or `ABC-1234` pattern in a log line is masked, including an uppercase request ID such as `REQ-12345`. This errs toward hiding data. (Low, new.)
- `.env` can now set `AUDIT_STDOUT=1`, which mirrors audit detail, including client names, to stdout. This was already possible from the shell and is a known gap in SECURITY.md. (Low, pre-existing.)
- `npm run check` and the pre-commit hook need `npm ci`. `npm test` and `npm start` still need no install. (Low, from #3.)
- Pre-existing and not changed: `src/platform/statements.js` writes the client name to audit detail, `src/server.js` has no authentication, and `main` has no branch protection.

## Rollback

Revert the follow-up merge commit, then `b6ab9bb` (#3), on `main`. No line-of-business or platform file changed, and no data, schema, or configuration migration is involved, so rollback is code only.

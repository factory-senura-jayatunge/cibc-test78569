# Runbooks

What to do when something in OBR's delivery pipeline or local API goes wrong. OBR is a synthetic model and is not deployed, so these runbooks cover CI, regression, and the API as it runs on a developer machine or CI runner. Each section says how you find out, how to diagnose, and how to recover.

## Signals and where to find them

| Signal | Where |
| --- | --- |
| Nightly regression failure | An open issue titled **Nightly regression failed**, created or updated by the `alert` job in [nightly-regression.yml](../../.github/workflows/nightly-regression.yml) |
| Flaky suite | `::warning` annotations and the **Flaky** line in the nightly run summary. `flaky` in `out/regression.json` |
| Pull request regression scope and result | The CI job summary (impact report) and the `impact-evidence` artifact |
| API request logs | JSON lines on stdout from `npm start`. Every line has `requestId`, `route`, `status`, and `durationMs` |
| API metrics | `GET /api/metrics` (Prometheus text format): `http_requests_total` and `http_request_duration_seconds` by route template |
| Security findings | CodeQL alerts in the repository's Security tab, the `zap-baseline-report` artifact from [dast.yml](../../.github/workflows/dast.yml), and Droid review comments on the pull request |

## Nightly regression failed

1. Open the run linked from the issue. The job summary lists each suite with `PASS`, `FAIL`, or `FLAKY` and the number of attempts.
2. Reproduce locally: `node scripts/regression.js --suites <suite-id>`. The failing suite's output is printed in full.
3. Find the change that broke it. Look up the suite's `file` and `covers` in `regression/catalog.json`, then run `git log --since=yesterday -- <those files>`. A failure in a suite whose files did not change usually comes from a shared-platform file further down the import chain: `npm run impact -- --base <last green commit>` shows the chain.
4. Fix forward with a pull request that names the change request ID, or revert the offending commit. Rollback for a release-train change is described in its release note under `docs/releases/`.
5. When the next nightly run passes, close the issue with a link to the fix.

## Flaky suite

A suite is flaky when it fails and then passes on the retry (`--retries 1` in the nightly run). The run still passes, so the flake does not block the release train, but it must not be ignored.

1. Confirm it: `node scripts/regression.js --suites <suite-id> --retries 5 --fail-on-flaky`. Run it a few times.
2. Look for the usual causes in the suite file under `tests/`: shared module state such as the in-memory audit log (`src/platform/audit.js`), real time (`new Date()`), port or network use, or test order.
3. Fix the test or the code under test. Do not add retries inside the test.
4. If the fix will take more than a day, open a `bug` issue naming the suite and its owner from `regression/catalog.json`.

## Scoped regression fails on a pull request

1. Read the impact report in the job summary. It explains why each suite was selected, for example `src/lob/private-banking/index.js → src/server.js`.
2. Run the same thing locally: `npm run impact -- --base origin/main`, then `npm run regression:scoped`.
3. If the failing suite is outside your line of business, a known coupling probably pulled it in. `npm run coupling` lists the two known boundary violations. Fix the test, or narrow the change so it stays inside `src/lob/<lob>/`.

## Quality job fails

| Step | Run locally | Usual fix |
| --- | --- | --- |
| Lint | `npm run lint` | `npm run lint:fix`. `no-restricted-imports` means a new cross-boundary import: route it through `src/platform/` instead |
| Format | `npm run format:check` | `npm run format` |
| Types | `npm run typecheck` | Add or correct JSDoc types in files that start with `// @ts-check` |
| Dead code | `npm run deadcode` | Remove the unused export, file, or dependency that knip names |
| Duplication | `npm run duplication` | Extract the repeated block into a shared helper |
| Docs | `npm run docs:check` | Update AGENTS.md, the README, or `docs/openapi.yaml` to match the code |
| Coverage | `npm run test:coverage` | Add tests. Do not lower the thresholds in `package.json` |

## API returns 500

The response body is always `{ "error": "Internal error" }`, and the response carries an `X-Request-ID` header.

1. Take the request ID from the response header, or from the caller, who can send their own `X-Request-ID`.
2. Find the log line: `npm start | grep '"requestId":"<id>"'`. The `request failed` entry has `route`, `status`, and `err` with the error name, message, code, and stack. Account numbers are masked and client names are redacted.
3. Reproduce with a test against `createServer()` in `tests/smoke.test.js`, then fix the handler or the module it calls.

## API is slow

1. Check latency by route: `curl -s localhost:3000/api/metrics | grep http_request_duration_seconds`.
2. Profile under load: `npm run profile`. It prints the hottest OBR functions and writes a `.cpuprofile` to `out/profiles/`. Open it in Chrome DevTools (Performance tab) or speedscope.app for a flame graph.
3. A known hot spot is `record` in `src/platform/audit.js`: the in-memory audit log grows without bound (a known gap in SECURITY.md). Restart the process to clear it.

## Escalation

The owning team for each area is in [.github/CODEOWNERS](../../.github/CODEOWNERS), and each suite's owner is in `regression/catalog.json`. Report security issues privately as described in [SECURITY.md](../../SECURITY.md).

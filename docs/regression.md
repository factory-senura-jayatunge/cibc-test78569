# Regression and impact analysis

The full regression catalogue takes 18 hours in production terms. Running all of it for every change is what makes a single release train slow. Impact analysis selects only the suites a change can affect, and explains why each one runs.

## The catalogue

`regression/catalog.json` registers every suite:

| Field | Meaning |
| --- | --- |
| `id` | Suite name |
| `owner` | Owning team: `platform` or a line of business |
| `file` | The test file under `tests/` |
| `covers` | Source files the suite is responsible for |
| `always` | Runs on every change (only `smoke`) |
| `productionMinutes` | How long the suite takes in the production regression environment |

| Suite | Owner | Covers | Production minutes |
| --- | --- | --- | --- |
| `smoke` | platform | `src/server.js` (always runs) | 30 |
| `platform-accounts` | platform | `src/platform/accounts.js` | 45 |
| `platform-pricing` | platform | `src/platform/pricing.js` | 45 |
| `platform-fees` | platform | `src/platform/fees.js`, `src/platform/money.js` | 90 |
| `platform-audit` | platform | `src/platform/audit.js` | 30 |
| `ie-trading` | investors-edge | `src/lob/investors-edge/trading.js` | 120 |
| `ie-statements` | investors-edge | `src/lob/investors-edge/index.js`, `src/platform/statements.js` | 75 |
| `wg-advisory` | wood-gundy | `src/lob/wood-gundy/advisory.js` | 120 |
| `wg-disclosure` | wood-gundy | `src/lob/wood-gundy/disclosure.js`, `src/lob/wood-gundy/letter-templates.js` | 60 |
| `wg-statements` | wood-gundy | `src/lob/wood-gundy/index.js`, `src/platform/statements.js` | 90 |
| `pic-mandates` | pic | `src/lob/pic/mandates.js` | 120 |
| `pic-statements` | pic | `src/lob/pic/index.js`, `src/platform/statements.js` | 75 |
| `pb-credit` | private-banking | `src/lob/private-banking/credit.js` | 120 |
| `pb-statements` | private-banking | `src/lob/private-banking/index.js`, `src/platform/statements.js` | 60 |
| `tooling-impact` | release-engineering | `scripts/impact.js`, `scripts/baseline.js`, `scripts/lib/graph.js`, `scripts/lib/dependencies.js` | 0 |
| **Total** | | | **1,080 (18 h)** |

The production minutes are illustrative. Locally, the whole catalogue runs in about 3 seconds.

## How suites are selected

`scripts/impact.js` works in four steps:

1. **Find changed files.** Against the release baseline manifest by default, against a Git ref with `--base <ref>`, or from an explicit list with `--files a,b`. If `package.json` or `package-lock.json` changed, the changed dependencies are diffed and every source file that imports one of them counts as changed too (a `--files` prediction has no before-state, so every declared dependency counts).
2. **Walk the import graph in reverse.** `scripts/lib/graph.js` parses every relative `import` and `export ... from` under `src/`. Starting from the changed files, it follows each file to the files that import it, until nothing new is reached.
3. **Select suites.** A suite runs if any file it covers was reached, if its own test file changed, or if it is marked `always`.
4. **Explain.** Each selected suite records the dependency chain that pulled it in, for example `src/lob/private-banking/index.js → src/server.js`. Any boundary violation on that chain is reported as coupling that widened the change.

Outputs:

| File | Written by | Contents |
| --- | --- | --- |
| `out/impact.json`, `out/impact-report.md` | `npm run impact` (baseline or `--base`) | Changed files, impacted files, selected and skipped suites with reasons, hours, percent saved |
| `out/impact-prediction.json`, `out/impact-prediction-report.md` | `npm run impact -- --files ...` | The same, for planned work. Kept separate so a prediction never changes what scoped regression runs |
| `out/regression.json`, `out/regression.md` | `npm run regression:*` | Pass, fail, or flaky per suite, with attempts and local and production-equivalent timings. The Markdown version is the CI job summary |

## Running regression

```bash
npm run impact               # select suites for the current change
npm run regression:scoped    # run only those suites
npm run regression:full      # run all 15 suites
node scripts/regression.js --suites pb-credit,pb-statements   # run named suites
node scripts/regression.js --all --retries 1                  # what the nightly run does
```

The runner exits non-zero if any suite fails, and prints the failing suite's output.

### Flaky suites

`--retries N` reruns a failing suite up to `N` more times. A suite that fails and then passes is marked `FLAKY`: it counts as passed, but it is listed in the console, as `flaky: true` on its result in `out/regression.json`, in the job summary, and as a warning annotation in the nightly run. Add `--fail-on-flaky` to make a flaky result fail the run, which is how you confirm a fix. Pull-request regression runs without retries, so a flaky suite blocks the merge until someone looks at it. See [the flaky-suite runbook](runbooks/README.md#flaky-suite).

## Example: why boundaries matter

One Wood Gundy change, two designs:

| Design | Files changed | Suites | Production time |
| --- | --- | --- | --- |
| Edit `src/lob/wood-gundy/advisory.js` | `advisory.js`, test | 6 of 15: `smoke`, `wg-advisory`, and all four `*-statements` suites, because `src/platform/statements.js` imports `advisory.js` (OBR-2231) | 7.5 h |
| Edit `src/lob/wood-gundy/index.js` | `index.js`, test | 2 of 15: `smoke`, `wg-statements` | 2.0 h |
| Bump `lodash` in `package.json` | `package.json`, `package-lock.json` | 3 of 15: `smoke`, `wg-disclosure`, `wg-statements`, because only `disclosure.js` imports lodash | 3.0 h |

WG-1042 shipped the second design.

## Limits

Static import analysis cannot see everything. It does not see:

- Runtime configuration and feature flags.
- Data contracts between services, or shared database state.
- Tests that import modules outside the files their suite `covers`.

For that reason, full regression still runs every night and before every release cut. Scoped regression decides what must pass before merge. It does not replace the full run.

## Adding a suite

1. Create `tests/<suite>.test.js`.
2. Add an entry to `regression/catalog.json` with `id`, `owner`, `file`, `covers`, and `productionMinutes`.
3. Run `npm run impact`. An unregistered test file is listed under **Unregistered test files** in the report.

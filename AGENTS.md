# AGENTS.md

Synthetic model of a wealth-platform monolith ("OBR") that serves four lines of business from one codebase and one release train. It exists for a Factory demo. There is no real code, system, or client data here.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | All unit and API tests (`node:test`, no dependencies) |
| `npm run check` | Every quality gate CI runs: lint (including module boundaries, complexity, and file size), format, types, dead code, duplication, docs drift, file size, and coverage thresholds |
| `npm run lint` / `npm run typecheck` / `npm run format` | One gate at a time. `npm run lint:fix` and `npm run format` rewrite files |
| `npm run test:coverage` | Tests with coverage thresholds (lines 95%, branches 85%, functions 90% of `src/`) |
| `npm run docs:check` | Checks that this file, the README, CONTRIBUTING.md, and `docs/openapi.yaml` match the code |
| `npm run impact` | Change-impact analysis against the release baseline. Writes `out/impact.json` and `out/impact-report.md` |
| `npm run impact -- --files a,b` | Predict the regression scope for files you plan to change, before changing them. Writes `out/impact-prediction.json` |
| `npm run regression:scoped` | Runs only the suites selected by the last impact analysis |
| `npm run regression:full` | Runs the whole catalogue (the 18-hour regression in production terms) |
| `npm run coupling` | Cross-boundary import report and extraction ranking. Writes `out/coupling-report.md` |
| `npm run release:pack` | Builds `out/release-pack.html` from the evidence in `out/` |
| `npm run profile` | CPU-profiles the API under load. Writes a `.cpuprofile` to `out/profiles/` |
| `npm start` | Portal at http://localhost:3000. JSON logs on stdout; `LOG_LEVEL` sets the level (see `.env.example`) |

Node 22 or later. Run `npm ci` after cloning and whenever `package-lock.json` changes; it installs the one runtime dependency (lodash), the dev tooling, and the pre-commit hook. The `run-quality-gates` skill in `.factory/skills/` explains how to fix each gate.

## Layout

- `src/platform/`: shared core used by every line of business (accounts, pricing, fees, money, audit, statements).
- `src/lob/investors-edge/`, `src/lob/wood-gundy/`, `src/lob/pic/`, `src/lob/private-banking/`: one folder per line of business. `index.js` is the module's public surface.
- `src/server.js`: HTTP API (a route table) and static portal.
- `src/observability/`: structured logger with scrubbing, Prometheus metrics, and request IDs. Request logging is wired up in `src/server.js`; other code reuses its masking helpers (for example `maskAccountIds`) rather than re-implementing them.
- `scripts/`: impact analysis, regression runner, coupling report, release pack, profiler, and the docs and file-size checks.
- `tests/<suite>.test.js`: one file per regression suite, registered in `regression/catalog.json`.
- `regression/catalog.json`: suite ownership, covered files, and production-equivalent duration.
- `docs/change-requests/`: incoming work items, mirrored as GitHub issues.
- `docs/releases/`: filed release notes, one per change request.
- `docs/openapi.yaml`: API schema. `docs/runbooks/README.md`: what to do when CI, regression, or the API fails.

## Rules

- Keep line-of-business changes inside `src/lob/<lob>/`. A change under `src/platform/` widens regression to every line of business, so call it out in the plan and justify it.
- Do not add imports from `src/platform/` into `src/lob/`, or between two lines of business. Two such imports already exist and are known debt: `statements.js -> wood-gundy/advisory.js` (OBR-2231) and `private-banking/credit.js -> investors-edge/trading.js`.
- Round money with `roundCents` and ratios with `roundRatio` from `src/platform/money.js`.
- New code must not write unmasked account numbers or client names to logs or audit detail. Runtime code logs through `src/observability/logger.js`, never `console`.
- New JavaScript files start with `// @ts-check` and pass `npm run typecheck` in strict mode. Follow the naming conventions in `CONTRIBUTING.md`.
- Every acceptance criterion gets a test whose name starts with its ID, for example `WG-1042 AC1: ...`.
- Register any new test file in `regression/catalog.json` with an owner, covered files, and `productionMinutes`.
- Do not commit, push, deploy, or edit `.baseline/`. A person approves and merges.

## Definition of done

1. `npm test` passes.
2. `npm run check` passes.
3. `npm run impact`, then `npm run regression:scoped`, passes.
4. `out/release-note-<ID>.md` exists with: summary, acceptance criterion to test mapping, the contents of `out/impact-report.md`, the scoped regression result, risks, and rollback.
5. The release note is filed as `docs/releases/<ID>.md` in the same pull request.

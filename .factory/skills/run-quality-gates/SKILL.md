---
name: run-quality-gates
description: Run and fix OBR's local quality gates (lint, module boundaries, format, types, dead code, duplication, docs drift, file size, coverage) before handing a change to a person. Use after editing code in this repository, when the CI quality job fails, or when asked whether a change is ready for review.
---

# Run quality gates

These are the same checks the `quality` job in `.github/workflows/ci.yml` runs. Run them after `npm test` passes and before the release-evidence steps in `AGENTS.md` ("Definition of done").

## 1. Make sure the tooling is installed

The app and `npm test` need no install. The gates do. If `node_modules/` is missing, run `npm ci`. It also installs the Husky pre-commit hook.

## 2. Run everything

```bash
npm run check
```

It stops at the first failing gate. Fix that gate, then run `npm run check` again.

## 3. Fix by gate

| Gate | Command | How to fix |
| --- | --- | --- |
| Lint | `npm run lint` | Run `npm run lint:fix` first. Fix the rest by hand. |
| Module boundaries | `npm run lint` (`no-restricted-imports`) | A file imported across a boundary: platform to a line of business, or one line of business to another. Do not add an exception. Move the shared logic into `src/platform/`, or pass it in from `src/server.js`. The only allowed exceptions are the two known-debt imports in `AGENTS.md`. |
| Complexity and size | `npm run lint` (`complexity`, `max-lines`, `max-lines-per-function`, `max-params`, `max-depth`) | Split the function or module. Do not raise the limits in `eslint.config.js`. |
| Naming | `npm run lint` (`camelcase`, `new-cap`, `id-denylist`) | Follow "Naming" in `CONTRIBUTING.md`. |
| Format | `npm run format:check` | `npm run format`. Do not reformat files listed under "Formatting deferred" in `.prettierignore` unless your change already touches them. If it does, format the file and delete its line. |
| Types | `npm run typecheck` | Only files starting with `// @ts-check` are checked, in strict mode. New JavaScript files must start with `// @ts-check`. Fix errors with JSDoc (`@param`, `@returns`, `@typedef`, `@type`). Do not use `any` or `@ts-ignore` to silence them. |
| Dead code | `npm run deadcode` | Delete the unused export, file, or dependency that knip names. If the export is part of a line-of-business public surface, export it from that `index.js`. |
| Duplication | `npm run duplication` | Extract the repeated block into a helper (for scripts, `scripts/lib/`). |
| Docs drift | `npm run docs:check` | Update `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, or `docs/openapi.yaml` to match the code. If you removed a known-debt import, delete it from `AGENTS.md` and from the exceptions in `eslint.config.js`. |
| File size | `npm run files:check` | Keep generated output in `out/`, which is gitignored. Split large files. |
| Coverage | `npm run test:coverage` | Add tests for the uncovered lines it lists. Do not lower the thresholds in `package.json`. |

## 4. Report

List each gate as passed or failed, the commands you ran, and anything you could not fix. Then continue with `npm run impact` and `npm run regression:scoped`.

# Contributing

Thanks for working on OBR. Read [AGENTS.md](AGENTS.md) first: it holds the rules for people and agents alike.

## Setup

You need Node 22 or later (see `.nvmrc`). Install before doing anything else:

```bash
npm ci          # dev tooling (ESLint, Prettier, TypeScript, knip, jscpd) and the pre-commit hook
npm test
npm run check   # every gate CI runs
npm start       # http://localhost:3000
```

A dev container in `.devcontainer/` sets up Node 22, the tooling, and the editor extensions. Copy `.env.example` to `.env` for local settings.

The pre-commit hook (`.husky/pre-commit`) lints and format-checks staged files, rejects files over 256 KB, type-checks, checks the docs, and runs `npm test`.

## Workflow

1. **Start from a change request.** Open an issue with the **Change request** template, or pick one up. Add its body to `docs/change-requests/`.
2. **Branch.** Name the branch after the change request, for example `wg-1042-fee-disclosure`.
3. **Predict the scope** with `npm run impact -- --files <planned files>` and include the result in your plan.
4. **Build and test** inside your line of business's folder.
5. **Prove it:** `npm test`, `npm run check`, `npm run impact`, `npm run regression:scoped`.
6. **File the release note** as `docs/releases/<ID>.md`, and add a line under `[Unreleased]` in `CHANGELOG.md`.
7. **Open a pull request** using the template. Link the issue with `Closes #<number>`.

See [docs/release-process.md](docs/release-process.md) for the full process.

## Rules

- Keep line-of-business changes inside `src/lob/<lob>/`. A change under `src/platform/` widens regression to every line of business, so justify it in the pull request.
- Do not add imports from the platform into a line of business, or between two lines of business. `npm run coupling` lists the two known exceptions.
- Round money with `roundCents` and ratios with `roundRatio` from `src/platform/money.js`.
- Do not write unmasked account numbers or client names to logs or audit detail.
- Name every acceptance test after its criterion: `WG-1042 AC1: ...`.
- Register new test files in `regression/catalog.json` with an owner, covered files, and `productionMinutes`.
- Do not edit `.baseline/`. Release managers update it at a release cut.

## Naming

ESLint enforces the mechanical parts (`camelcase`, `new-cap`, `id-denylist`). The rest is convention:

| Thing | Convention | Example |
| --- | --- | --- |
| Files and folders | kebab-case, `.js` | `request-context.js`, `src/lob/private-banking/` |
| Test files | `<suite-id>.test.js`, matching the suite ID in `regression/catalog.json` | `pb-credit.test.js` |
| Functions and variables | camelCase, verb first for functions | `creditSummary`, `buildQuarterlyStatement` |
| Classes and error types | PascalCase, errors end in `Error` | `OrderError` |
| Module-level constants and lookup tables | UPPER_SNAKE_CASE | `FEE_SCHEDULES`, `ACCOUNTS` |
| Line-of-business IDs | kebab-case strings, as used in `lob` fields and folder names | `'wood-gundy'` |
| Error codes | UPPER_SNAKE_CASE strings on `error.code` | `NOT_FOUND`, `INVALID_ORDER` |
| Route paths | lowercase plural nouns, `:camelCase` parameters | `/api/statements/:accountId` |
| Acceptance tests | start with the change request and criterion ID | `WG-1042 AC1: ...` |

Avoid placeholder names such as `data`, `obj`, or `tmp`. Name the thing the value is.

## Types

Type checking is strict and opt-in per file: files that start with `// @ts-check` are checked by `npm run typecheck`. Every new JavaScript file must start with `// @ts-check` and use JSDoc for parameter and return types. Release-baseline files under `src/platform/`, `src/lob/`, and `tests/` adopt it when a change already touches them, so adoption does not widen regression on its own.

## Dependency updates

The application has one runtime dependency: lodash, pinned by the Wood Gundy fee disclosure letters (WG-977). Keep the count that low: any further runtime dependency needs a change request and an owner.

Dev tooling versions are pinned exactly in `package.json` and locked in `package-lock.json`. Dependabot (`.github/dependabot.yml`) proposes updates weekly. Do not adopt a release until it has been public for at least 7 days (14 for a major version). Dependabot's `cooldown` enforces this for its own pull requests, and the same rule applies to manual updates: check the publish date with `npm view <package> time`.

## Commit messages

Start with the change request ID, then say what changed in the imperative mood:

```text
WG-1042: Add annual fee disclosure to Wood Gundy statements
```

## Review

`.github/CODEOWNERS` assigns reviewers by area. Every pull request needs:

- Green CI, including the scoped regression.
- An approving review from the owning team.
- A release note under `docs/releases/`.

Agents can prepare changes and evidence. Only a person approves and merges.

## Test data

All data in this repository is synthetic. Never add real client names, account numbers, or other personal data, including in tests, fixtures, issues, or screenshots.

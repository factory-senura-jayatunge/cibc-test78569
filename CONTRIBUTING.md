# Contributing

Thanks for working on OBR. Read [AGENTS.md](AGENTS.md) first: it holds the rules for people and agents alike.

## Setup

You need Node 22 or later (see `.nvmrc`). There are no dependencies.

```bash
npm test
npm start   # http://localhost:3000
```

## Workflow

1. **Start from a change request.** Open an issue with the **Change request** template, or pick one up. Add its body to `docs/change-requests/`.
2. **Branch.** Name the branch after the change request, for example `wg-1042-fee-disclosure`.
3. **Predict the scope** with `npm run impact -- --files <planned files>` and include the result in your plan.
4. **Build and test** inside your line of business's folder.
5. **Prove it:** `npm test`, `npm run impact`, `npm run regression:scoped`.
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

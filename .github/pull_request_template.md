## Change request

Closes #

## Summary

<!-- What changed, in business terms. -->

## Line of business

- [ ] Investor's Edge
- [ ] Wood Gundy
- [ ] PIC
- [ ] Private Banking
- [ ] Shared platform (justify below: this widens regression to every line of business)

## Regression scope

<!-- Paste the summary from `npm run impact`. CI posts the full report to the job summary. -->

Suites: X of 15, Y h of 18 h production-equivalent.

## Acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | |

## Checklist

- [ ] The change stays inside `src/lob/<lob>/`, or the platform change is justified above
- [ ] No new imports between lines of business, or from the platform into a line of business
- [ ] Money uses `roundCents` and ratios use `roundRatio`
- [ ] No unmasked account numbers or client names in logs or audit detail
- [ ] Each acceptance test name starts with its criterion ID
- [ ] New test files are registered in `regression/catalog.json`
- [ ] `npm test`, `npm run impact`, and `npm run regression:scoped` pass
- [ ] Release note filed as `docs/releases/<ID>.md`, and `CHANGELOG.md` updated

## Risks and rollback

<!-- Known risks, pre-existing issues you did not touch, and how to roll back. -->

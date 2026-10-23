---
description: Go/no-go summary for the current change, built only from evidence the repository produces
---

Produce a release go/no-go for the current working tree.

1. Run `npm test`, `npm run impact`, and `npm run regression:scoped`.
2. Read `out/impact-report.md` and `out/regression.json`.
3. Answer in this order, each in one or two sentences: verdict (GO or NO-GO), what changed, lines of business affected, regression run versus full (hours and percent), failures if any, residual risk, and what a human still has to approve.

Do not run the full regression unless I ask. Do not commit or deploy.

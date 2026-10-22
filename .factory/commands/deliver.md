---
description: Take a change request from plan to release-ready evidence, pausing for approval before any edit
argument-hint: <change-request file or ID, e.g. WG-1042>
---

Deliver the change request `$ARGUMENTS`. Find it in `docs/change-requests/` if only an ID is given. Follow `AGENTS.md`.

1. **Understand.** Read the change request and the code it touches. Name the line of business and the files you expect to change.
2. **Predict the blast radius.** Run `npm run impact -- --files <comma-separated planned source files>` and report which regression suites the plan would trigger, in hours, and why. If a shared-platform file or a known coupling widens the scope, say so and offer a narrower alternative if one exists.
3. **Plan and stop.** Present a short plan: files, approach, one test per acceptance criterion, and the predicted regression scope. Wait for my explicit approval before editing anything.
4. **Implement.** Make the change and the tests. Register any new test file in `regression/catalog.json`.
5. **Verify.** Run `npm test`, then `npm run impact`, then `npm run regression:scoped`. Fix failures before continuing.
6. **Independent check.** Delegate to the `acceptance-verifier` droid with the change request path. Report its verdict as-is.
7. **Evidence.** Write `out/release-note-<ID>.md` as described in `AGENTS.md`.
8. **Stop.** Do not commit, push, or deploy. End with a three-line summary for a release manager: what changed, regression scope versus full, and the verifier's verdict.

---
description: Autonomous release train. Delivers change requests in parallel, proves them, verifies and reviews them, then stops for human approval
argument-hint: <change-request IDs, e.g. WG-1042 PB-2210>
---

Run the release train for: `$ARGUMENTS`. If no IDs are given, use every file in `docs/change-requests/`.

Work autonomously from intake to the approval gate. Do not ask me anything before Stage 7. Follow `AGENTS.md`. Never commit, push, merge, or deploy.

Narrate for an audience watching live. Before each stage print one line, `▶ Stage N/7: <name>`, and after it one line starting with `✓` that states the result with numbers. Keep everything else short.

**Stage 1: Intake and blast radius.** Read each change request and the code it touches. For each one, name the line of business and the source files you will change, then run `npm run impact -- --files <planned source files>` to predict its regression scope. Where a coupling would widen the scope, choose the design that keeps the change inside its line-of-business boundary and say so in one sentence.

**Stage 2: Build in parallel.** Start one `worker` subagent per change request in a single message, so they run at the same time. Give each one: its change request path, the files it may edit (only its own `src/lob/<lob>/` folder and its own suite's test files), the rules in `AGENTS.md`, and the instruction to run `npm test` and report the files it changed. If the Task tool is unavailable, implement the requests yourself, one after another.

**Stage 3: Prove it.** Run `npm test`, then `npm run impact`, then `npm run regression:scoped`. If anything fails, fix it and rerun this stage.

**Stage 4: Independent checks in parallel.** In a single message, start one `acceptance-verifier` per change request and one `release-reviewer` for the whole change set. If the Task tool is unavailable, run each droid with `droid exec` instead.

**Stage 5: Close the loop.** If a verifier reports a GAP, or the reviewer reports a high or medium finding in code this release changed, fix it, rerun Stage 3, and rerun only the check that failed. Record findings in code this release did not touch as pre-existing; do not fix them.

**Stage 6: Evidence.** Write `out/release-note-<ID>.md` for each change request in the format `AGENTS.md` describes. Write `out/checks.json` as `{"changes":[{"id":"","lineOfBusiness":"","acceptance":"VERIFIED or GAPS FOUND","review":"one short line","decision":"one short line on a design choice the agent made"}]}`. Then run `npm run release:pack` and `open out/release-pack.html`.

**Stage 7: Human gate.** Stop and print exactly this, filled in:

```
## Release train ready for approval

| Change | Line of business | Files changed | Acceptance | Review |
| --- | --- | --- | --- | --- |

Regression: X of 13 suites, Y h of 18 h production-equivalent (Z% less). All passed: yes/no.
Full regression is still recommended before the release cut.

Agent decisions worth knowing:
- (up to 3)

Open risks:
- (up to 3)

Evidence: out/release-pack.html, out/release-note-*.md, out/impact-report.md

Reply APPROVE to approve this release, or REJECT <reason> to send it back.
Nothing is merged or deployed until a person does it.
```

If I reply **APPROVE**, write `out/approval.json` with `{"decision":"approved","at":<ISO time>,"changes":[...],"regression":{...}}`, rerun `npm run release:pack`, and print one line confirming the release is approved and ready for a person to merge. If I reply **REJECT** with a reason, address it, rerun from Stage 3, and stop at this gate again.

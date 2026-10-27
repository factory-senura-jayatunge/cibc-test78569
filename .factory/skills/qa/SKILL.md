---
name: qa
description: >-
  Functional QA for the OBR portal and API: diff-driven flows via droid-control and curl. Use when testing PRs or smoke testing localhost. NOT for unit tests, lint, or CI checks.
metadata:
  version: '1.0.0'
---

# QA Orchestrator

**SCOPE: This skill performs manual/functional QA only -- verifying that the application actually works by interacting with it as a real user would (browser, API calls). Do NOT run or report on CI checks, linting, typecheck, `npm test`, `npm run check`, `npm run regression:*`, or any static analysis. Those belong to the CI workflows. This is QA of user-facing behavior, nothing else.**

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for the environment, personas, and app definitions.

For the web app, invoke the `droid-control` skill before interacting with the portal. Follow its routing tables:

- Load the target driver selected for the app (agent-browser for the portal; plain curl for the API).
- Use the Capture and Verify stages on every run.
- Load Compose only when both `video_evidence: true` and `droid_control.compose: true` in config.yaml.
- When either is false, never invoke Compose. Keep raw captures and text snapshots as evidence.

Treat `droid_control.compose` as a runtime toggle. Read it on every run; do not cache the install-time answer. Do not repeat the resolved boolean in this file or any app sub-skill. Keep all branch instructions conditional on the config value so changing the config is sufficient.

## Step 2: Determine Target Environment

Use `default_target` from config.yaml. This project has exactly one environment, `local-dev`: the app has no deployed environments and no preview deployments, so QA always runs against a dev server started from the checked-out branch code.

- In CI, the workflow starts the server from the checked-out branch code before QA: verify it with `curl -fsS http://localhost:3000/api/health` and reuse it.
- Locally, do NOT reuse a server you did not start in this run: a healthy `/api/health` does not prove which checkout is serving, and other checkouts of this repo default to the same port. Start a fresh `npm start` in the background from the current repo root and poll `/api/health` until it responds; if port 3000 is busy, set `PORT` and use that base URL instead.
- Never test a PR against any code other than the branch's own checkout. If the server cannot start, report that app's flows as BLOCKED with the startup error.

There are no environment restrictions (synthetic data, read-only flows).

## Step 3: Analyze Git Diff

Run `git diff` to determine what changed (the CI prompt names the diff base; locally default to `origin/main`). Map changed files to apps using the `path_patterns` in config.yaml:

- `public/**` or `src/server.js` changed -> the **web** app (portal) is affected.
- Anything under `src/**` changed -> the **api** app is affected (`src/server.js` matches both).

Files that match NO app's path_patterns (`.factory/**`, `docs/**`, `.github/**`, `tests/**`, `scripts/**`, `regression/**`, `security/**`, and root config files like `package.json`, `eslint.config.js`, `tsconfig.json`) are NOT associated with any app. Do NOT run app test flows for them.

For each affected app:

- Run ONLY that app's flows from its sub-skill (`.factory/skills/qa-web/SKILL.md` or `.factory/skills/qa-api/SKILL.md`).
- Generate ADDITIONAL targeted tests based on the specific changes in the diff.

For apps NOT affected by the diff: do NOT run their flows or pre-flight checks as a matter of course -- the diff determines scope. One exception: when an affected app's change surfaces in the other app (for example, a `src/platform/accounts.js` fixture change must appear in the portal with no `public/` changes), read the sibling sub-skill and run exactly the flow that verifies that integration point, plus its pre-flight checks. Named flows only, never the sibling's whole menu.

If NO app is affected by the diff (docs-only, CI-only, or config-only changes), report as INCONCLUSIVE: "No app code changed -- QA not applicable for this diff." Do NOT run any app flows.

## Step 4: Pre-flight Checks (app-specific only)

Run pre-flight checks ONLY for apps affected by the diff:

- Dev server health: `curl -fsS http://localhost:3000/api/health` returns `{"status":"ok"}`. Start it if not running (Step 2). Both apps share this one server.
- `droid-control@factory-plugins` active (`droid plugin list --scope project`): only for the web app.
- ImageMagick present (`command -v magick`): only for the web app, and only when `imagemagick: true` in config.yaml, before generating any GIF diff.
- Compose prerequisites from the droid-control skill's Compose atom: only when `droid_control.compose: true`. When Compose is on, let the Compose atom resolve its own plugin root, prerequisites, and any first-run renderer setup -- follow the atom's documented setup exactly and do not pre-install or hard-code tool locations it does not name. Never install Compose prerequisites when Compose is off.

If a pre-flight check fails for an affected app, report it as BLOCKED with the specific error and remediation steps -- but still proceed with other affected apps.

## Step 5: Execute Diff-Relevant Flows Only

For each app that IS affected by the diff, read its sub-skill. The sub-skill contains a MENU of available test flows. You must:

1. Read the diff carefully and identify which flows are relevant to the change.
2. Run those flows PLUS adjacent flows that verify the change integrates correctly (e.g., a new account fixture must appear in the portal with no `public/` changes; a new route must not break existing routes).
3. Do NOT run completely unrelated flows (a Wood Gundy disclosure change does not need Private Banking credit tests).
4. If no existing flow covers the change, write a NEW ad-hoc test that directly verifies the changed behavior.
5. Do NOT run unit tests, lint, typecheck, or any automated test suite. This is manual/functional QA -- interact with the app as a real user would.

## Step 6: Evidence Capture

Generate a unique RUN_ID for this run (the CI run id when provided, else a timestamp) and save all evidence files under `./qa-results/$RUN_ID/`. After each significant test step, capture evidence. Use **text snapshots as primary evidence** -- they render inline in the PR comment with no image hosting issues.

For the web app (agent-browser):

- Use the `droid-control` web route; let its agent-browser atom own browser mechanics and its Capture atom own the recording lifecycle.
- Capture the page's accessibility tree as text evidence through the routed droid-control driver.
- Save screenshot files to `./qa-results/$RUN_ID/` for the artifact upload.
- Read `video_evidence` from config.yaml at run time. When it is false (or when an upload fails): do NOT embed `![image](url)` markdown in the report; artifact and repository URLs cannot be displayed inline in GitHub PR comments. Instead mention the filename and note it is available in the downloadable artifacts.

For the API app (curl):

- Embed trimmed request/response pairs directly in the report as fenced code blocks with a descriptive label: the curl invocation, the status line, headers that matter (such as `X-Request-ID`), and the JSON body trimmed to the meaningful part.
- Each snapshot MUST show something DIFFERENT. Never repeat the same output twice.

Evidence quality rules:

- Focus on the RELEVANT content. Trim snapshots to the meaningful part.
- Label each snapshot clearly: what it shows and why it matters for the test.
- NEVER embed broken image links. If you cannot verify an image URL will resolve, use text evidence instead.
- The workflow uploads all files in `./qa-results/` as a downloadable artifact -- reference that for visual evidence.

## Step 7: Test Quality Gate

TEST QUALITY REQUIREMENTS:

1. CHANGE-SPECIFIC FIRST. Prioritize tests that directly verify the behavioral change in the diff. At least half your tests should be testing the new/changed feature itself.
2. INTEGRATION TESTS ARE VALID. Tests that verify the change integrates correctly with existing features are good (a new account appears in the portal's LOB list; a changed fee schedule flows into the statement's advisory section). These are NOT smoke tests.
3. NO UNRELATED FLOWS. Do NOT test features completely unrelated to the diff.
4. NO AUTOMATED TEST SUITES. Do NOT run `npm test`, `npm run check`, or any CI-style checks.
5. NEGATIVE TESTS. Include at least 1 test verifying error handling or boundary conditions related to the change.
6. INTERACTIVE TESTING. Test by actually interacting with the app as a real user would (click the portal, call the API).
7. INCONCLUSIVE IF UNSURE. If you cannot articulate what the diff changes, mark as INCONCLUSIVE rather than PASS.

## Step 8: Handle Failures

**Never silently skip a flow.** If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it. Then continue to the next flow -- never abort the entire run for a single failure.

## Step 9: Generate Report

Generate the report at `./qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`. Key rules:

- Start with `## QA Report` heading followed by the test results table.
- Result column MUST use emojis: :white_check_mark: PASS, :x: FAIL, :no_entry: BLOCKED, :warning: FLAKY, :grey_question: INCONCLUSIVE
- Keep it CONCISE. The table + a short "Action Required" section (if any) + collapsed evidence = the entire report.
- Do NOT include behavioral-change summaries, blocked-flow prose, info metadata tables, or verbose explanations of the diff. The reviewer already knows that.
- Do NOT report setup/prerequisite steps (starting the server, checking plugin status) as test rows. Only report rows that verify actual user-facing behavior.
- Put ALL evidence in a single collapsed `<details>` block.
- Web evidence: embed accessibility tree snapshots as text; reference screenshot filenames for visual proof (available in downloadable artifacts). Do NOT use `![image](url)` markdown unless a verified upload URL exists.
- API evidence: labeled fenced code blocks with trimmed request/response pairs.

## Step 10: Suggest Skill Updates (Failure Learning)

After generating the report, check whether any BLOCKED or FAIL result revealed a **testing environment insight** that would help future QA runs succeed -- how the environment works, not bad selectors or expected behavior changes from the PR.

Read `failure_learning` from config.yaml to pick the strategy:

- `suggest_in_report`: include the findings as a "Suggested Skill Updates" table in the report only. Do NOT write `skill-updates.json`.
- `auto_commit` or `open_pr`: include the table AND write `qa-results/skill-updates.json` (array of `{ file, section, action, content }` entries) so the workflow can apply the edits.

Table format:

```markdown
## Suggested Skill Updates (N issues found)

| #   | Severity        | File     | Issue               | Fix Prompt                                                                           |
| --- | --------------- | -------- | ------------------- | ------------------------------------------------------------------------------------ |
| 1   | <emoji> <level> | `<file>` | <short description> | <details><summary>Copy</summary><br>`<full droid prompt to fix the issue>`</details> |
```

Severity levels: `🔴 Breaking` (causes failures every run), `🟡 Degraded` (intermittent or suboptimal), `🔵 Info` (new knowledge, no failures).

Each Fix Prompt must be a self-contained instruction Droid can execute directly when pasted. Do NOT suggest updates for failures already covered in a sub-skill's Known Failure Modes, bad selectors, or expected behavior changes from the PR. If no genuinely new environment insights were discovered, omit the section entirely.

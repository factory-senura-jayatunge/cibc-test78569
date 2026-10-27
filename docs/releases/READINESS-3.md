# Release note: READINESS-3, automated functional QA

**Line of business:** None (delivery tooling)
**Files changed:** `.factory/skills/qa/SKILL.md` (new), `.factory/skills/qa/config.yaml` (new), `.factory/skills/qa/REPORT-TEMPLATE.md` (new), `.factory/skills/qa/.install-progress.yaml` (new), `.factory/skills/qa-web/SKILL.md` (new), `.factory/skills/qa-api/SKILL.md` (new), `.factory/settings.json` (new), `.github/workflows/qa.yml` (new), `.gitignore`, `README.md`, `CHANGELOG.md`, docs

## Summary

Functional QA is now automated and diff-driven. A `qa` orchestrator skill maps the files changed in a pull request to the affected apps using the path patterns in `.factory/skills/qa/config.yaml` (`public/**` and `src/server.js` map to the portal; `src/**` maps to the API), loads only the relevant sub-skill, and reports INCONCLUSIVE when no app code changed. `qa-web` drives the statement portal through droid-control (agent-browser): portal load, LOB switch, statement render, portal-API integration, and money-formatting edges. `qa-api` exercises all eight routes with curl, including the request-ID echo rules, Prometheus metrics labels, and the error-status mapping, with negative cases. Both sub-skills run as a single anonymous visitor persona (the app has no authentication) and capture text-first evidence (accessibility-tree snapshots, trimmed request/response pairs) under `qa-results/`, which is now gitignored and uploaded as a workflow artifact.

A new QA workflow starts the dev server from the checked-out branch code on the runner (the same pattern as DAST), runs the `qa` skill through `droid exec --auto high` in non-interactive mode, uploads `qa-results/` with 14-day retention, and posts or updates exactly one sticky PR comment per PR (marked `<!-- qa-report -->`). The check is informational: `continue-on-error` keeps the job green and the report carries the result, so branch protection must not require it. Setup steps read `imagemagick`, `video_evidence`, and `droid_control.compose` from config.yaml at run time, so flipping a toggle in config is sufficient to change behavior on the next run. `.factory/settings.json` enables `droid-control@factory-plugins` at project scope so interactive flows have a driver. ImageMagick is installed for animated GIF diffs of before/after screenshots; video evidence and Compose stay off by default.

## Acceptance criteria to tests

| Criterion | Test | Result |
| --- | --- | --- |
| AC1: diff maps to apps | `.factory/skills/qa/SKILL.md` Step 3 plus `apps.*.path_patterns` in `.factory/skills/qa/config.yaml`; verified by the QA workflow run on this pull request | PASS |
| AC2: portal flows | `.factory/skills/qa-web/SKILL.md` flow menu, driven through droid-control by the QA workflow on this pull request | PASS |
| AC3: API flows | `.factory/skills/qa-api/SKILL.md` flow menu (all 8 routes plus negative cases), run by the QA workflow on this pull request | PASS |
| AC4: workflow and sticky comment | `.github/workflows/qa.yml`; verified by its run on this pull request (marker `<!-- qa-report -->`, informational `continue-on-error`, cancelled runs cannot clobber the comment) | PASS |
| AC5: plugin enabled and evidence ignored | `droid plugin list --scope project` reports `droid-control@factory-plugins` active; `.gitignore` lists `qa-results/` | PASS |

## Change impact

Compared against: `git diff origin/main` (CI mode).

**Regression scope:** 1 of 15 suites (smoke, always runs), 0.5 h of 18.0 h production-equivalent (97% less than full regression). No runtime code or tests changed; no line of business is affected.

## Scoped regression result

**Scoped regression (`npm run regression:scoped`):** smoke passed (1/1). `npm test`: 83 of 83 passed. Full regression still runs nightly.

## Risks

- The QA job needs the `FACTORY_API_KEY` repository secret (already required by Droid Auto Review); without it the QA step fails and the comment reports that no report was produced. (Low, known.)
- The sticky comment is posted with `GITHUB_TOKEN` and job-scoped `pull-requests: write`; a cancelled run cannot overwrite the last good report (`!cancelled()` guard). (Low.)
- Functional QA is informational only; a person still reviews and approves. (By design.)
- `droid exec` consumes Factory credits; one run per PR push, concurrency-cancelled on rapid pushes. (Low.)

## Rollback

Revert the merge commit and delete `.factory/skills/qa/`, `.factory/skills/qa-web/`, `.factory/skills/qa-api/`, `.factory/settings.json`, and `.github/workflows/qa.yml`. No data, schema, or configuration changes are involved; removing the workflow stops the runs, and removing `.factory/settings.json` disables the droid-control plugin at project scope.

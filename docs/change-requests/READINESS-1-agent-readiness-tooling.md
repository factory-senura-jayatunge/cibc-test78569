# READINESS-1: Agent-readiness tooling and its review fixes

**Line of business:** None (delivery tooling, observability, and CI)
**Requested by:** factory-senura-jayatunge, from the Agent Readiness report `f3657cf2`
**Target release:** 2026.11 release train

## Why

The Agent Readiness report scored OBR at Level 2, passing 28 of 72 criteria. `/readiness-fix` added the missing tooling in #3. The Droid review of #3 then found that request logs can leak account numbers, the file-size gate can be bypassed, and the documented `.env` setup does nothing. Those must be fixed before the tooling can be relied on.

## Acceptance criteria

1. **AC1:** Account numbers are masked in logs even when they sit next to `_` or other word characters, for example the request ID `request_WG-30115520`.
2. **AC2:** The file-size check measures files whose names Git would quote, such as names with non-ASCII characters.
3. **AC3:** `scripts/check-file-size.js --staged` measures the staged blob, not the working copy.
4. **AC4:** `npm start` loads `.env` if it exists, without overriding variables already set in the environment.

## Constraints

- Change no file under `src/platform/` or `src/lob/`, so regression stays within the smoke suite.
- Keep the full regression catalogue at 18 hours.
- `npm test` and `npm start` must still run with no install step.

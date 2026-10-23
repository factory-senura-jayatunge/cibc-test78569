# Security policy

## Scope

OBR is a synthetic model built for a demo. It holds no real client data, and it is not deployed anywhere. Security still matters here, because the repository models the rules a production wealth platform must follow.

## Reporting a vulnerability

Do not open a public issue. Report it privately through [GitHub private vulnerability reporting](https://github.com/factory-senura-jayatunge/cibc-test78569/security/advisories/new). Include the affected file and line, a description, and steps to reproduce. We aim to acknowledge reports within two business days.

## Supported versions

Only `main` is supported.

## Data handling rules

- Never commit real client names, account numbers, or other personal data. All test data must be synthetic.
- New code must not write unmasked account numbers or client names to logs or audit detail.
- Never commit secrets, tokens, or `.env` files. `.env.example` is the committed template, and it holds no secrets.
- OBR itself needs no secrets. CI secrets, such as `FACTORY_API_KEY` for the Droid review workflow, live in GitHub Actions secrets and are referenced as `${{ secrets.NAME }}`. Locally, keep them in your OS keychain or an untracked `.env`.
- Runtime code logs through `src/observability/logger.js`. It masks account numbers and redacts client-name and credential fields. The `no-console` lint rule blocks direct `console` use under `src/`.

## Automated security checks

| Check | Where |
| --- | --- |
| CodeQL static analysis | `.github/workflows/codeql.yml` |
| OWASP ZAP baseline scan of the running app | `.github/workflows/dast.yml` |
| Droid security review on pull requests | `.github/workflows/droid-review.yml` |
| Dependency updates, held 7 days after release | `.github/dependabot.yml` |
| Dependency scanning (`npm audit` → SARIF → code scanning) | `.github/workflows/security-scan.yml` |

## Known gaps

These are tracked and accepted for a local model. A production deployment would have to close all of them:

| Gap | Location |
| --- | --- |
| The HTTP API has no authentication or authorization | `src/server.js` |
| The statement audit event writes the client name to audit detail | `src/platform/statements.js` |
| The audit log is in memory and is lost on restart | `src/platform/audit.js` |
| `AUDIT_STDOUT=1` writes audit detail to stdout | `src/platform/audit.js` |
| Responses set no security headers (CSP, `X-Content-Type-Options`, `X-Frame-Options`), so the ZAP baseline scan reports warnings | `src/server.js` |
| lodash 4.17.20 has known advisories (CVE-2021-23337, CVE-2020-28500, and others), reachable through the draft-letter `variable` option | `src/lob/wood-gundy/disclosure.js`, tracked in `security/findings/2026-10-22-sca.md` |

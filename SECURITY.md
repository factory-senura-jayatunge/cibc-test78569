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
- Never commit secrets, tokens, or `.env` files.

## Known gaps

These are tracked and accepted for a local model. A production deployment would have to close all of them:

| Gap | Location |
| --- | --- |
| The HTTP API has no authentication or authorization | `src/server.js` |
| The statement audit event writes the client name to audit detail | `src/platform/statements.js` |
| The audit log is in memory and is lost on restart | `src/platform/audit.js` |
| `AUDIT_STDOUT=1` writes audit detail to stdout | `src/platform/audit.js` |

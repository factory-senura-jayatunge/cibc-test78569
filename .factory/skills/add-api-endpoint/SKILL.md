---
name: add-api-endpoint
description: Add or change an HTTP endpoint in OBR's API (src/server.js) with the route table, OpenAPI spec, docs, smoke test, logging, and metrics kept in step. Use when a change request needs a new or changed /api route, request field, or response field.
---

# Add an API endpoint

`src/server.js` is covered by the `smoke` suite, and every line of business is wired through it. Keep endpoint logic in the line of business's module. The server only routes.

## Steps

1. **Predict scope.** Run `npm run impact -- --files src/server.js,<line-of-business files>` and include the result in your plan.
2. **Put the logic in the line of business.** Add or extend a function in `src/lob/<lob>/` and export it from that folder's `index.js`. Do not import another line of business. Validation errors should throw an `Error` with `code: 'NOT_FOUND'` (404), or a `RangeError` (400). Order validation uses `code: 'INVALID_ORDER'` (400). Anything else becomes a 500 with the message `Internal error`.
3. **Register the route.** Add an entry to `ROUTES` in `src/server.js`: `{ method, path, handle }`. Use `:name` for path parameters, for example `/api/credit/:accountId`. The path template is the `route` label in logs and metrics, so never put raw IDs in it. `handle` returns `{ body }`, and optionally `status` and `contentType`.
4. **Do not log client data.** The request logger already records method, route, status, duration, and request ID. If you log anything else, use the logger from `src/observability/logger.js`. It masks account numbers and redacts `holder`, but do not rely on that for free-text messages that contain client names.
5. **Document it.** Add the path and its schemas to `docs/openapi.yaml`, and add an example to `docs/api.md` and the API table in `README.md`. `npm run docs:check` fails if `docs/openapi.yaml` and the `ROUTES` table disagree.
6. **Test it.** Add HTTP-level tests to `tests/smoke.test.js` (status code, body shape, error cases). If the change implements an acceptance criterion, start the test name with its ID, for example `PB-2210 AC3: ...`. Add unit tests for the line-of-business function to that line of business's suite file.
7. **Verify.** Run `npm test`, then the `run-quality-gates` skill, then `npm run impact` and `npm run regression:scoped`.

## Check before you finish

- `curl -si localhost:3000/<path>` returns an `x-request-id` header.
- `curl -s localhost:3000/api/metrics | grep '<route template>'` shows the new route after one request.
- No account number or client name appears in the `npm start` output for the new route.

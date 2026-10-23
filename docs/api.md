# API reference

The API serves JSON at `/api/*` on port 3000 (`PORT` overrides it). The statement portal is served from `/`. Every response uses `content-type: application/json; charset=utf-8`, except `/api/metrics`, which uses the Prometheus text format. The machine-readable schema is [openapi.yaml](openapi.yaml).

## Request IDs and logs

Every response has an `X-Request-ID` header. If the request sends a safe `X-Request-ID` (1 to 128 letters, digits, `.`, `_`, `:`, or `-`), the server reuses it. Otherwise it generates a UUID. A W3C `traceparent` header contributes its trace ID as `traceId`.

`npm start` writes one JSON line per request to stdout, with `requestId`, `method`, `route` (the template, such as `/api/statements/:accountId`), `status`, and `durationMs`. 5xx responses are logged as `request failed` with the error. Account numbers are masked (`WG-****5520`) and client names are redacted. `LOG_LEVEL` sets the level: `debug`, `info` (the default for `npm start`), `warn`, `error`, or `silent`.

> [!WARNING]
> The API has no authentication. It is a model and must not be exposed outside a local machine. See [SECURITY.md](../SECURITY.md).

## Errors

Errors return `{ "error": "<message>" }`.

| Status | When |
| --- | --- |
| 400 | Invalid order, invalid quarter, wrong account type for the endpoint, or malformed JSON |
| 404 | Unknown account, unknown symbol, unknown route, or an account with no mandate |
| 500 | Unexpected error. The message is always `Internal error` |

## `GET /api/health`

```json
{ "status": "ok" }
```

## `GET /api/metrics`

Prometheus metrics for this process. Labels use route templates, never raw paths, so account numbers stay out of metrics. Unmatched API paths share the `unmatched` route label, and portal files share `static`.

```text
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/statements/:accountId",status="200"} 3
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/statements/:accountId",le="0.005"} 3
http_request_duration_seconds_count{method="GET",route="/api/statements/:accountId"} 3
process_uptime_seconds 42.1
```

## `GET /api/accounts`

Lists account summaries. `lob` is optional: `investors-edge`, `wood-gundy`, `pic`, or `private-banking`.

```http
GET /api/accounts?lob=wood-gundy
```

```json
{
  "accounts": [
    { "id": "WG-30115520", "lob": "wood-gundy", "holder": "Meera Singh", "type": "Fee-based advisory" }
  ]
}
```

## `GET /api/statements/:accountId`

Builds the quarterly statement for any account. `quarter` uses the format `YYYY-Qn` and defaults to `2026-Q3`. `lines` and `total` come from the shared statement builder. `sections` come from the account's line of business.

```http
GET /api/statements/WG-30115520?quarter=2026-Q3
```

```json
{
  "statement": {
    "accountId": "WG-30115520",
    "lob": "wood-gundy",
    "holder": "Meera Singh",
    "quarter": "2026-Q3",
    "lines": [
      { "label": "Cash", "amount": 28000 },
      { "label": "Holdings at market value", "amount": 245600 },
      { "label": "Advisory fee charged this quarter", "amount": -1011.25 }
    ],
    "total": 272588.75,
    "sections": [
      {
        "title": "Advisory relationship",
        "rows": [
          { "label": "Advisor", "value": "R. Okafor" },
          { "label": "Household assets", "value": 273600 },
          { "label": "Annual advisory fee (projected)", "value": 4045 },
          { "label": "Effective annual advisory fee rate (bps)", "value": 147.8 },
          { "label": "Advisory fees, trailing four quarters", "value": 4045 }
        ]
      }
    ]
  }
}
```

## `POST /api/orders/preview`

Previews an Investor's Edge order. Nothing is placed.

```http
POST /api/orders/preview
content-type: application/json

{ "accountId": "IE-58210043", "symbol": "NSE-CDNEQ", "side": "buy", "qty": 10 }
```

```json
{
  "order": {
    "accountId": "IE-58210043",
    "symbol": "NSE-CDNEQ",
    "side": "buy",
    "qty": 10,
    "price": 38.42,
    "gross": 384.2,
    "commission": 6.95,
    "estimatedNet": 391.15
  }
}
```

An invalid order returns 400:

```json
{ "error": "qty must be a positive integer" }
```

## `GET /api/credit/:accountId`

Summarizes a Private Banking credit facility. Other account types return 400. `ltvStatus` is `ok` below 0.60, `watch` from 0.60 to 0.70 inclusive, and `margin-call-warning` above 0.70.

```http
GET /api/credit/PB-12003885
```

```json
{
  "credit": {
    "accountId": "PB-12003885",
    "limit": 120000,
    "drawn": 52000,
    "available": 68000,
    "collateralAccount": "IE-58210077",
    "loanToValue": 0.5472,
    "ltvStatus": "ok"
  }
}
```

## `POST /api/advisory/:accountId/fee-disclosure`

Renders a Wood Gundy advisory fee disclosure letter (WG-977, shipped in 2026.10). Send `templateId` for a catalogued letter (`annual-fee-disclosure` or `fee-change-notice`), or a `draft` with its own lodash template source. A draft may also set `variable`, the lodash `_.template` setting that names the data object inside the template body; catalogued templates use `letter`. Accounts from other lines of business return 400.

```http
POST /api/advisory/WG-30115520/fee-disclosure
content-type: application/json

{ "templateId": "annual-fee-disclosure" }
```

```json
{
  "letter": {
    "title": "Annual advisory fee disclosure",
    "body": "Dear Meera Singh,\n\nThis letter discloses the advisory fees for account WG-30115520, advised by R. Okafor.\nHousehold assets: 273600 CAD.\nProjected annual advisory fee: 4045 CAD.\n\nWood Gundy Client Reporting"
  }
}
```

A draft letter:

```http
POST /api/advisory/WG-30115520/fee-disclosure
content-type: application/json

{ "draft": { "title": "Ad-hoc fee note", "source": "Fee <%- letter.annualFee %> CAD for <%- letter.holder %>", "variable": "letter" } }
```

```json
{
  "letter": {
    "title": "Ad-hoc fee note",
    "body": "Fee 4045 CAD for Meera Singh"
  }
}
```

Rendering a letter writes an `advisory.fee-disclosure.rendered` audit event with the account number masked (`WG-****5520`) and no client name.

## `GET /api/mandates/:accountId/drift`

Compares a PIC account's allocation with its mandate. Accounts without a mandate return 404.

```http
GET /api/mandates/PIC-77004101/drift
```

```json
{
  "drift": {
    "accountId": "PIC-77004101",
    "mandate": "Balanced Income",
    "rows": [
      { "assetClass": "equity", "target": 0.5, "actual": 0.615, "drift": 0.115 },
      { "assetClass": "fixed-income", "target": 0.4, "actual": 0.2555, "drift": -0.1445 },
      { "assetClass": "cash", "target": 0.1, "actual": 0.1294, "drift": 0.0294 }
    ],
    "needsRebalance": true
  }
}
```

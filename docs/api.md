# API reference

The API serves JSON at `/api/*` on port 3000 (`PORT` overrides it). The statement portal is served from `/`. Every response uses `content-type: application/json; charset=utf-8`.

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
          { "label": "Annual advisory fee (projected)", "value": 4045 }
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

Summarizes a Private Banking credit facility. Other account types return 400.

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
    "loanToValue": 0.5472
  }
}
```

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

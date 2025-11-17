# API Overview

## Authentication

| Mode | How | Notes |
| --- | --- | --- |
| API Key | `Authorization: Bearer pk_<prefix>...` or `x-api-key` header. | One key per request. Disabled when revoked. |
| Session | Supabase auth cookie. | Internal UI / logged-in developers only. |

Common error codes:

- `401` – unauthenticated / invalid API key  
- `402` – `insufficient_credits`  
- `403` – `api_access_disabled` (plan gating)  
- `429` – `rate_limit_exceeded`

## Response Headers

| Header | Meaning |
| --- | --- |
| `X-Auth-Mode` | `api_key` or `session` |
| `X-Plan-Code` | Effective plan code (`free`, `starter`, `professional`, `enterprise`) |
| `X-Watermarked` | `true` when outputs include watermarking |
| `X-RateLimit-Limit` / `Remaining` / `Reset` | Per-plan rate limits (window in seconds) |
| `X-Usage-New-Balance` | Balance after a usage event |
| `X-Usage-Was-Duplicate` | `true` if the supplied `requestId` already existed |

All external routes return `Cache-Control: no-store` and allow CORS (`Access-Control-Allow-Origin: *`).

## Endpoints

| Method | Path | Scope | Description |
| --- | --- | --- | --- |
| GET | `/api/external/ping` | `api.v1.default` | Verifies API key + plan headers. |
| POST | `/api/external/generate/text` | `api.v1.generate` | Generates a text response, applies watermark note for Free tier, charges usage. |
| POST | `/api/external/generate/image` | `api.v1.generate` | Returns PNG (watermarked for Free tier) and charges usage. |
| GET | `/api/billing/plan` | session | Returns plan snapshot + feature flags + admin flag. |
| GET | `/api/billing/balance` | session | Latest credit balance. |
| GET | `/api/billing/history` | session | Credits + usage records (day range). |
| GET | `/api/billing/invoices` | session | Stripe invoices (paginated). |
| GET | `/api/keys` | session | List API keys. |
| POST | `/api/keys` | session | Create API key (plaintext shown once). |
| POST | `/api/keys/revoke` | session | Revoke API key. |
| POST | `/api/stripe/checkout` | session | Create subscription checkout session. |
| POST | `/api/stripe/portal` | session | Open customer portal. |
| GET | `/api/admin/analytics/overview` | admin | Org-wide aggregates (admin only). |
| GET | `/api/admin/analytics/usage.csv` | admin | Download org usage CSV. |

## Rate Limits by Plan

| Plan | Scope `api.v1.default` (requests/min) | Scope `api.v1.generate` (requests/min) |
| --- | --- | --- |
| Free | 30 | 30 |
| Starter | 120 | 120 |
| Professional | 600 | 600 |
| Enterprise | 5,000 | 5,000 |

Limits are enforced per plan using in-DB counters (`public.rate_limit_counters`) and exposed via the `X-RateLimit-*` headers. Exceeding a limit returns `429 rate_limit_exceeded`.



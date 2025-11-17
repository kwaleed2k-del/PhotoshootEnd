# Operations Runbook

## Environment Variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Required for server/service clients. |
| `SUPABASE_SERVICE_ROLE_KEY` | Needed by Express + test helpers for admin operations. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe API + webhook verification. |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL` | Monthly subscription price IDs. |
| `CRON_SECRET` | Shared secret between Supabase Edge cron, `scripts/ops/runMonthlyGrantHttp.ts`, and `/api/admin/run-monthly-grant`. |
| `ADMIN_GRANT_URL` | Public URL for the Express admin grant endpoint. |
| `TEST_API_BASE_URL`, `TEST_FREE_API_KEY`, `TEST_PRO_API_KEY` | Optional integration-test settings. |

## Secrets & Rotation

- Rotate API keys and Stripe secrets via provider dashboards, then update `.env`, Supabase project env vars, and any GitHub Actions secrets.
- `CRON_SECRET` must match in Express, Supabase Edge Functions, and ops scripts.
- Stripe webhook signing secret change requires updating `STRIPE_WEBHOOK_SECRET`.

## Monthly Grants

- Scheduled via Supabase Cron (`cron-monthly-grant` function).
- Logs summary to `billing_events` for auditing.
- Manual execution: `npm run ops:grant -- 2025-11 --dry` (dry-run) or omit `--dry`.
- Idempotent per user/period because of `credit_tx_monthly_unique_idx`.

## Webhooks & Monitoring

- Failed Stripe webhook events remain in Stripe’s dashboard; replay once the issue is resolved.
- `billing_events` keeps all webhook payloads for forensic analysis.
- To test locally: `stripe listen --forward-to localhost:8787/api/stripe/webhook`.

## Rate Limit / Credits Smoke Tests

- `tests/integration/*` hit the running API when test env vars + seeded accounts exist; otherwise they are skipped.
- To simulate low credits: insert a `credit_transactions` row with negative delta or trigger `monthly_grant` manually.
- `X-RateLimit-*` headers expose remaining requests per plan; rate limit counters live in `public.rate_limit_counters`.

## Backups

- Use Supabase scheduled backups or `supabase db dump` for on-demand backups before migrations touching billing/subscription tables.



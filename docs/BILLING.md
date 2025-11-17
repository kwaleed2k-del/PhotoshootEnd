# Billing & Credits

## Plans & Features

| Plan | Monthly credits | API access | Watermarking |
| --- | --- | --- | --- |
| Free | 10 | ❌ | ✅ (all assets) |
| Starter | 100 | ❌ | ❌ |
| Professional | 500 | ✅ | ❌ |
| Enterprise | Unlimited | ✅ | ❌ |

Credits top up automatically via the monthly grant job (see below). Enterprise is handled via Stripe + manual provisioning.

## Monthly Grant Job

- Each user receives `monthly_grant` credit transactions based on their plan.
- Uniqueness guard: `credit_tx_monthly_unique_idx` on `(user_id, metadata->>'period') WHERE reason='monthly_grant'`.
- Admin endpoint: `POST /api/admin/run-monthly-grant?period=YYYY-MM&dry=1` (requires `x-cron-secret` header).
- Automations:
  - Supabase Edge Function `cron-monthly-grant` POSTs to `ADMIN_GRANT_URL`.
  - Supabase Cron (config in `supabase/config.toml`) runs on the 1st of each month.
  - Summary payload is logged to `billing_events` (`type: monthly_grant_run`).
- Manual run: `npm run ops:grant -- 2025-11 --dry` (`CRON_SECRET` + `ADMIN_GRANT_URL` must be set).

## Stripe Integration

- Checkout subscriptions via `/api/stripe/checkout` using price IDs (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`).
- Customer portal via `/api/stripe/portal`.
- Webhook `/api/stripe/webhook` verifies signatures (uses `STRIPE_WEBHOOK_SECRET`) and:
  - Logs `billing_events` (deduped by `billing_events_stripe_unique_idx` on `stripe_object_id`).
  - Normalizes `public.subscriptions` so only one row per user is `active|trialing|past_due`.
- Invoice history surfaces `stripe.invoices.list` results through `/api/billing/invoices`.

## Watermarking

- `shouldWatermark(userId)` checks plan features.
- `attachWatermarkFlag` middleware adds `X-Watermarked` header and ensures generated assets append/preserve watermarks when required.
- Image pipeline uses `applyWatermarkIfRequired` (Sharp optional; no-op if missing).



# Database Backup & RLS Playbook

## Backup Strategy
- **Supabase Managed Backups:** Paid plans include automated daily backups with point-in-time recovery (PITR). Confirm retention (typically 7–30 days depending on tier) via the Supabase dashboard.
- **Manual Snapshots (Recommended pre-deploy):**
  ```bash
  # Export full database
  pg_dump \
    --dbname $SUPABASE_DB_URL \
    --format=custom \
    --file="backups/$(date +%Y%m%d-%H%M)-siyada.dump"
  ```
- **Retention Guidance:** Keep at least 7 days of daily snapshots and a weekly archive for one month. Store offsite (S3/Blob storage) when possible.
- **Pre-Deploy Checklist:**
  - [ ] Confirm latest automated backup timestamp in Supabase dashboard
  - [ ] Run manual `pg_dump` snapshot
  - [ ] Verify backup file integrity (non-zero size)
  - [ ] Document backup location in the release notes

## Phase-1 RLS Summary
| Table | Read Policy | Write Policies |
|-------|-------------|----------------|
| `credit_transactions` | Users may select their own rows (`credit_tx_select_self`) | Service role only may insert/update/delete (`credit_tx_service_*`). Client insert policy removed for security (Migration 1.10). |
| `billing_events` | Users may select their own rows (`billing_events_select_self`) | Service role may insert (`billing_events_service_insert`) for Stripe webhook processing. |
| `subscription_history` | Users may select their own rows (`subhist_select_self`) | Service role may insert (`subhist_service_insert`) when Stripe lifecycle events arrive. |
| `usage_analytics` | Users may select their own rows (`usage_analytics_select_self`) | Service role may insert/update (`usage_analytics_service_*`) while aggregations run server-side. |
| `credit_packages` | Anyone may select active packages (`credit_packages_select_active`) | Service role may insert/update/delete (`credit_packages_service_*`) until admin dashboard ships (future task will gate to admin role). |

**Service Role Rationale:** Phase-1 prioritizes locking down end-user writes while allowing trusted server/webhook flows. Admin-only mutations will be narrowed further when the Admin dashboard lands.

## Verification Checklist
1. **Apply migrations:**
   ```bash
   supabase db push
   ```
2. **Review policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('credit_transactions','billing_events','subscription_history','usage_analytics','credit_packages')
   ORDER BY tablename, policyname;
   ```
3. **Smoke test (service role):** Use a service-role token (via local script or Supabase SQL editor with `SET role = 'service_role';`) to insert into each table and ensure success.
4. **Smoke test (user role):** Revert to anon/user context (`RESET role;`) and confirm inserts fail while `SELECT` on own rows still succeeds.

## RPC Permissions

**Credit Ledger & Generation Logging Functions:** All RPC functions (`fn_add_credits`, `fn_deduct_credits`, `fn_refund_credits`, `fn_log_generation`) are restricted to `service_role` only. End-users cannot call these functions directly.

**Verification:**
```sql
-- Check function privileges
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  r.rolname AS grantee,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN ('fn_add_credits', 'fn_deduct_credits', 'fn_refund_credits', 'fn_log_generation')
  AND p.pronamespace = 'public'::regnamespace
  AND r.rolname IN ('public', 'authenticated', 'service_role')
ORDER BY p.proname, r.rolname;
```

**Expected Result:**
- `service_role` has `can_execute = true` for all functions
- `public` and `authenticated` have `can_execute = false` for all functions

**Credit Transactions Policy:** The `credit_tx_insert_self` policy has been removed. Only service role can insert credit transactions via RPC functions.

## Point-in-Time Recovery Notes
- Supabase paid tiers offer PITR; consult billing plan to confirm window (e.g., 7 days).
- In the event of accidental writes, use the dashboard to roll back to a timestamp prior to the issue.
- Always export critical data (e.g., `credit_transactions`) before initiating PITR to avoid losing legitimate new data.

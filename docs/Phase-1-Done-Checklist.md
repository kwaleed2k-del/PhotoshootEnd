# Phase-1 Done Checklist

Use this checklist to verify Phase-1 deployment is complete and working correctly.

## Pre-Deployment

- [ ] **Run provisioning SQL (once)** → Verify row on signup
  ```bash
  # Apply Migration 1.12 or run sql/provisioning_trigger.sql
  supabase db push
  ```
  - [ ] Trigger `on_auth_user_created` exists on `auth.users`
  - [ ] Function `handle_new_user()` exists in `public` schema

## Test User Setup

- [ ] **Create test user** (`qa1@siyada.local`) → Capture `QA_USER_ID`
  ```bash
  QA_USER_EMAIL=qa1@siyada.local QA_USER_PASSWORD=StrongPass!123 npm run qa:create-user
  ```
  - [ ] User created successfully
  - [ ] `QA_USER_ID` captured and set in `.env`
  - [ ] `public.users` row created automatically (trigger fired)

- [ ] **Seed credits** (grant + usage)
  ```bash
  QA_USER_ID=<uuid> npm run qa:seed-credits
  ```
  - [ ] 200 credits granted successfully
  - [ ] 35 credits deducted (usage) successfully
  - [ ] Final balance = 165 credits

## UI Verification

- [ ] **Login as QA user** → Open `/billing` → Balance & history visible
  - [ ] Plan badge displays correctly (should show "Free")
  - [ ] Credit balance matches database (should be 165)
  - [ ] Low credit warning does NOT appear (balance ≥ 10)

- [ ] **History modal works:**
  - [ ] Click "View History" button
  - [ ] Modal opens successfully
  - [ ] Shows 2 transactions (grant + usage)
  - [ ] Transaction amounts show correct signs:
    - [ ] Grant: `+200` (green)
    - [ ] Usage: `-35` (red)
  - [ ] Balance after shows running balance correctly

- [ ] **Filters work:**
  - [ ] Type filter: Select "usage" → Only usage transaction shown
  - [ ] Type filter: Select "grant" → Only grant transaction shown
  - [ ] Type filter: Select "all" → Both transactions shown
  - [ ] Days filter: Select "Last 7 days" → Both transactions shown (recent)
  - [ ] Days filter: Select "Last 30 days" → Both transactions shown

## Security Verification

- [ ] **Browser only does SELECT queries:**
  - [ ] Open DevTools → Network tab
  - [ ] Navigate to `/billing`
  - [ ] Verify only SELECT queries to `public.users`
  - [ ] Verify only SELECT queries to `credit_transactions`
  - [ ] No INSERT/UPDATE/DELETE from client
  - [ ] No RPC calls from client

- [ ] **RPCs blocked for anon; succeed with service-role (scripts):**
  - [ ] From browser console, attempt RPC call:
    ```typescript
    const { error } = await supabase.rpc('fn_add_credits', {
      p_user_id: '<user-id>',
      p_amount: 10,
      p_description: 'test'
    });
    // Expected: Permission denied error
    ```
  - [ ] Verify error: "permission denied" or similar
  - [ ] Verify `npm run qa:seed-credits` still works (service-role succeeds)

- [ ] **Supabase logs clean (no anon/auth INSERTs):**
  - [ ] Check Supabase dashboard → Logs
  - [ ] Verify no INSERT attempts from anon/authenticated roles to:
    - [ ] `credit_transactions`
    - [ ] `billing_events`
    - [ ] `subscription_history`
    - [ ] `usage_analytics`

## Database Verification

- [ ] **Policies verified:**
  ```sql
  SELECT schemaname, tablename, policyname, roles, cmd
  FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('users','credit_transactions')
  ORDER BY tablename, policyname;
  ```
  - [ ] `users_select_self` exists (SELECT only)
  - [ ] `credit_tx_select_self` exists (SELECT only)
  - [ ] `credit_tx_service_insert/update/delete` exist
  - [ ] **NO** `credit_tx_insert_self` (removed)

- [ ] **RPC grants verified:**
  ```sql
  SELECT routine_schema, routine_name, grantee, privilege_type
  FROM information_schema.role_routine_grants
  WHERE routine_schema='public'
    AND routine_name IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation')
  ORDER BY routine_name, grantee;
  ```
  - [ ] Only `service_role` has EXECUTE for all functions
  - [ ] **NO** `public` or `authenticated` grants

## Rollback Documentation

- [ ] **Rollback snippet documented:**
  - [ ] Migration 1.11 rollback: `DROP POLICY IF EXISTS "users_select_self" ON public.users;`
  - [ ] Migration 1.10 rollback: See `docs/Phase-1-Release-Runbook.md`
  - [ ] Migration 1.12 rollback: `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`

## Final Sign-Off

- [ ] All checks above completed
- [ ] No errors in Supabase logs
- [ ] UI works correctly for test user
- [ ] Security verified (no client writes)
- [ ] Ready for production use

**Status:** ✅ Phase-1 Complete

---

## Quick Commands Reference

```bash
# Create test user
QA_USER_EMAIL=qa1@siyada.local QA_USER_PASSWORD=StrongPass!123 npm run qa:create-user

# Seed credits
QA_USER_ID=<uuid> npm run qa:seed-credits

# Apply migrations
supabase db push

# Build
npm run build
```


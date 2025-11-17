# Phase-1 Release Runbook (Billing RLS)

## Pre-Deploy

- [ ] **Build & tag:** `npm run build`
- [ ] **DB snapshot:** 
  ```bash
  pg_dump --dbname $SUPABASE_DB_URL --format=custom --file="backups/$(date +%Y%m%d-%H%M)-siyada.dump"
  ```
  - Verify backup file created and non-zero size
  - Record artifact path: `backups/YYYYMMDD-HHMM-siyada.dump`
  - Confirm Supabase managed backup timestamp in dashboard

## Deploy

- [ ] **Apply migrations:** 
  ```bash
  supabase link --project-ref <your-project-ref>
  supabase db push
  ```
  - Expected: All 12 migrations apply successfully (1.1 through 1.12)

## Post-Deploy Verification

### 1. Policies Verification

```sql
-- Check users and credit_transactions policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('users','credit_transactions')
ORDER BY tablename, policyname;
```

**Expected:**
- ✅ `users_select_self` (SELECT only) on `users` table
- ✅ `credit_tx_select_self` (SELECT only) on `credit_transactions` table
- ✅ `credit_tx_service_insert/update/delete` (service role writes)
- ❌ **NO** `credit_tx_insert_self` (client insert policy removed)

### 2. RPC EXECUTE Grants

```sql
-- Check RPC function permissions
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation')
ORDER BY routine_name, grantee;
```

**Expected:**
- ✅ Only `grantee = 'service_role'` with `privilege_type = 'EXECUTE'` for all functions
- ❌ **NO** `grantee = 'public'` or `grantee = 'authenticated'`

### 3. User Provisioning (Hard Gate)

**Ensure `public.users.id == auth.uid()` via trigger:**

```sql
-- Verify trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND trigger_name = 'on_auth_user_created';
```

**Expected:** Trigger exists and fires on `INSERT` to `auth.users`

**Test trigger:**
- Create a new auth user (via Supabase dashboard or `npm run qa:create-user`)
- Verify `public.users` row is created automatically with matching `id`

### 4. UI Checks

1. **Open `/billing` (logged in):**
   - [ ] Plan badge displays correctly
   - [ ] Credit balance visible and matches database value
   - [ ] Low credit warning appears if balance < 10

2. **"View History" modal:**
   - [ ] Opens successfully
   - [ ] Shows last 50 transactions (or fewer if less exist)
   - [ ] Filters work:
     - [ ] Type filter (usage/purchase/refund/etc.) filters correctly
     - [ ] Days filter (7/30/90/all time) filters correctly
   - [ ] Transaction amounts show correct signs (+/−)
   - [ ] Balance after shows running balance

3. **DevTools → Network:**
   - [ ] Only SELECT queries to `public.users`
   - [ ] Only SELECT queries to `credit_transactions`
   - [ ] No INSERT/UPDATE/DELETE from client
   - [ ] No RPC calls from client
   - [ ] All reads return 200 OK (RLS working)

### 5. Negative Tests

1. **RPC from browser (anon) is denied:**
   ```typescript
   // From browser console (should fail)
   const { data, error } = await supabase.rpc('fn_add_credits', {
     p_user_id: '<user-id>',
     p_amount: 10,
     p_description: 'test'
   });
   // Expected: Permission denied error
   ```

2. **Supabase logs show no anon/auth INSERTs to billing tables:**
   - Check Supabase dashboard → Logs
   - Verify no INSERT attempts from anon/authenticated roles to:
     - `credit_transactions`
     - `billing_events`
     - `subscription_history`
     - `usage_analytics`

### 6. Rollback

**If needed, rollback Migration 1.11 (users_select_self policy):**

```sql
DROP POLICY IF EXISTS "users_select_self" ON public.users;
```

**Rollback Migration 1.10 (RPC grants):**
```sql
-- Restore function owners (if needed)
ALTER FUNCTION public.fn_log_generation(...) OWNER TO <original_owner>;
ALTER FUNCTION public.fn_refund_credits(...) OWNER TO <original_owner>;
ALTER FUNCTION public.fn_deduct_credits(...) OWNER TO <original_owner>;
ALTER FUNCTION public.fn_add_credits(...) OWNER TO <original_owner>;

-- Revoke service role grants
REVOKE EXECUTE ON FUNCTION public.fn_log_generation(...) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.fn_refund_credits(...) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.fn_deduct_credits(...) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.fn_add_credits(...) FROM service_role;
```

**Rollback Migration 1.12 (user provisioning trigger):**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

---

## Quick Reference

- **Migration Plan:** `docs/migration-plan.md`
- **Verification Checklist:** `docs/migration-verification-checklist.md`
- **Deployment Checklist:** `docs/deployment-checklist.md`
- **Provisioning Trigger:** `sql/provisioning_trigger.sql` (standalone SQL for reference)


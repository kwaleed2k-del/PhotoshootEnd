# Final "Push the Button" Deployment Checklist

## Pre-Deployment

### 1. Build & Tag Release
```bash
npm run build
# Tag release (if using version control)
git tag -a v1.0.0-phase1 -m "Phase 1: Credit system, RLS, and billing UI"
git push origin v1.0.0-phase1
```

### 2. Database Snapshot
```bash
# Create manual backup before applying migrations
pg_dump \
  --dbname $SUPABASE_DB_URL \
  --format=custom \
  --file="backups/$(date +%Y%m%d-%H%M)-siyada.dump"
```

**Verify:**
- [ ] Backup file created and non-zero size
- [ ] Record artifact path: `backups/YYYYMMDD-HHMM-siyada.dump`
- [ ] Supabase managed backup timestamp confirmed in dashboard

### 3. Apply Migrations
```bash
# Ensure Supabase CLI is linked
supabase link --project-ref <your-project-ref>

# Apply all Phase 1 migrations
supabase db push
```

**Expected:** All 12 migrations apply successfully (1.1 through 1.12)

## Post-Deployment Verification

### 4. Verify RLS Policies

**Check users and credit_transactions policies:**
```sql
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

### 5. Verify RPC EXECUTE Grants

**Check RPC function permissions:**
```sql
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation')
ORDER BY routine_name, grantee;
```

**Expected:**
- ✅ Only `grantee = 'service_role'` with `privilege_type = 'EXECUTE'` for all functions
- ❌ **NO** `grantee = 'public'` or `grantee = 'authenticated'`

### 6. Verify User Provisioning Trigger

**Check trigger exists:**
```sql
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

**Test trigger (optional):**
```sql
-- Create a test auth user (if you have admin access)
-- Then verify public.users row was created automatically
SELECT id, email, subscription_plan, credits_balance
FROM public.users
WHERE id = '<test-auth-user-id>';
```

### 7. UI Smoke Test

1. **Navigate to billing page:**
   - Open `/billing` in browser
   - Sign in if not already authenticated

2. **Verify balance displays:**
   - [ ] Plan badge shows correct tier
   - [ ] Credit balance matches database value
   - [ ] Low credit warning appears if balance < 10

3. **Test history modal:**
   - [ ] Click "View History" button
   - [ ] Modal opens with transaction list
   - [ ] Last 50 transactions load (or fewer if less exist)
   - [ ] Filters work (type dropdown, days filter)
   - [ ] Transaction amounts show correct signs (+/−)
   - [ ] Balance after shows running balance

4. **Verify read-only:**
   - [ ] Open browser DevTools → Network tab
   - [ ] Only SELECT queries from client
   - [ ] No INSERT/UPDATE/DELETE from client
   - [ ] No RPC calls from client
   - [ ] All reads return 200 OK (RLS working)

### 8. Sanity Tests

**Test 1: Anon/Auth RPC calls should fail**
```typescript
// From browser console (should fail)
const { data, error } = await supabase.rpc('fn_add_credits', {
  p_user_id: '<user-id>',
  p_amount: 10,
  p_description: 'test'
});
// Expected: Permission denied error
```

**Test 2: Service-role RPCs succeed**
```bash
# Run smoke tests (use service role)
TEST_USER_ID=<uuid> tsx server/scripts/creditSmoke.ts
TEST_USER_ID=<uuid> tsx server/scripts/generationSmoke.ts
```

**Expected:** Both smoke tests pass

### 9. Monitoring

**Watch Supabase logs for:**
- [ ] No anon/auth INSERT attempts to billing tables (should be blocked)
- [ ] Server uses `supabaseAdmin` with `SUPABASE_SERVICE_ROLE_KEY` for all writes
- [ ] RPC calls only from service role (not from client)

**Check for errors:**
- [ ] No RLS policy violations in logs
- [ ] No permission denied errors for legitimate reads
- [ ] No trigger failures for user provisioning

### 10. Rollback Readiness

**Have rollback SQL ready:**

**Migration 1.11 (users_select_self policy):**
```sql
DROP POLICY IF EXISTS "users_select_self" ON public.users;
```

**Migration 1.10 (RPC grants):**
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

**Migration 1.12 (user provisioning trigger):**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

## Final Sign-Off

- [ ] All migrations applied successfully
- [ ] Policies verified (users_select_self present, no client inserts)
- [ ] RPC grants verified (service_role only)
- [ ] User provisioning trigger deployed
- [ ] UI smoke test passed
- [ ] Sanity tests passed (anon fails, service-role succeeds)
- [ ] Monitoring shows no unauthorized writes
- [ ] Rollback SQL prepared and documented

**Status:** ✅ Ready to ship Phase 1

---

## Quick Reference

- **Migration Plan:** `docs/migration-plan.md`
- **Verification Checklist:** `docs/migration-verification-checklist.md`
- **Phase 1 Completion:** `docs/phase1-completion-checklist.md`
- **Backup Guide:** `docs/db-backup-and-rls.md`
- **UI Smoke Test:** `server/scripts/uiBalanceSmoke.md`


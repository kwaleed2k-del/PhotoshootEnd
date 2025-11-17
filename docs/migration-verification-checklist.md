# Migration Verification Checklist

## Migration 1.10: Security & RPC Grants

### Pre-Application

- [ ] Backup database (see `docs/db-backup-and-rls.md`)
- [ ] Ensure Supabase CLI is linked: `supabase link --project-ref <your-project-ref>`

### Application

```bash
supabase db push
```

### Verification Queries

#### 1. Function Owners & EXECUTE Grants

**Check function owners (should all be `postgres`):**
```sql
SELECT n.nspname AS schema, p.proname AS function, r.rolname AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname='public'
  AND p.proname IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation');
```

**Expected:** All functions show `owner = 'postgres'`

**Check EXECUTE grants (only service_role should have access):**
```sql
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation')
ORDER BY routine_name, grantee;
```

**Expected:** Only `grantee = 'service_role'` with `privilege_type = 'EXECUTE'` for all functions

#### 2. Policy Verification (Users & Credit Transactions)

**Check policies on both tables:**
```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('users','credit_transactions')
ORDER BY tablename, policyname;
```

**Expected:**
- ✅ `users_select_self` (SELECT only) on `users` table
- ✅ `credit_tx_select_self` (users can read their own transactions)
- ✅ `credit_tx_service_insert` (service role can insert)
- ✅ `credit_tx_service_update` (service role can update)
- ✅ `credit_tx_service_delete` (service role can delete)
- ❌ **NO** `credit_tx_insert_self` (client insert policy removed)

#### 3. Sanity Checks

**Test 1: RPC calls with anon/auth tokens should fail**
- Attempt to call any RPC function from browser/client code
- **Expected:** Permission denied error (no EXECUTE grant)

**Test 2: RPC calls with service-role should succeed**
- Use `SUPABASE_SERVICE_ROLE_KEY` in server code
- **Expected:** Functions execute successfully

**Test 3: Re-run smoke tests**
```bash
# Service-role backed scripts should still work
TEST_USER_ID=<uuid> tsx server/scripts/creditSmoke.ts
TEST_USER_ID=<uuid> tsx server/scripts/generationSmoke.ts
```

**Expected:** Both smoke tests pass (they use service role client)

### Gotchas to Watch

1. **⚠️ CRITICAL: User Row Provisioning**
   - **Ensure `public.users.id` equals `auth.users.id` (Supabase Auth user ID) for every user**
   - The `users_select_self` policy uses `auth.uid() = id`, so they must match
   - **Verification:**
     ```sql
     -- Check if any auth users don't have a corresponding public.users row
     SELECT au.id AS auth_id, au.email
     FROM auth.users au
     LEFT JOIN public.users pu ON au.id = pu.id
     WHERE pu.id IS NULL;
     ```
   - **If rows are missing:** Create a database trigger or server-side handler to auto-create `public.users` row on signup
   - **Example trigger (if needed):**
     ```sql
     CREATE OR REPLACE FUNCTION public.handle_new_user()
     RETURNS TRIGGER AS $$
     BEGIN
       INSERT INTO public.users (id, email, subscription_plan, credits_balance)
       VALUES (NEW.id, NEW.email, 'free', 0);
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql SECURITY DEFINER;
     
     CREATE TRIGGER on_auth_user_created
       AFTER INSERT ON auth.users
       FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
     ```

2. **Server Code Only:** Ensure all RPC calls use `server/services/supabaseAdmin.ts` (service-role client)
   - ❌ Never call RPCs from browser/client code
   - ✅ Only call from server-side code with service role

3. **Frontend Dependencies:** If you previously allowed client inserts into `credit_transactions`:
   - [ ] Check for any frontend code that directly inserts into `credit_transactions`
   - [ ] Remove or update to use server endpoints instead
   - [ ] Verify no client-side code relies on `credit_tx_insert_self` policy

4. **Service Role Key Security:**
   - ✅ **Server-side only:** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser
   - ✅ **Client uses anon key:** Browser code uses `VITE_SUPABASE_ANON_KEY` only
   - ✅ **No RPC calls from client:** All credit ledger operations via server endpoints

### Post-Verification

- [ ] All verification queries return expected results
- [ ] Smoke tests pass
- [ ] No frontend code attempts direct RPC calls
- [ ] Server code uses service-role client for all credit operations

---

## Quick Reference: All Phase-1 Migrations

1. **1.1** - Extend users table (credits, subscription fields)
2. **1.2** - Create credit_transactions table
3. **1.3** - Create subscription_history table
4. **1.4** - Create credit_packages table
5. **1.5** - Create billing_events table
6. **1.6** - Extend user_generations with credit tracking
7. **1.7** - Create usage_analytics table
8. **1.8** - RLS hardening & helper indexes
9. **1.9** - Credit ledger RPC functions
10. **1.10** - Security & RPC grants
11. **1.11** - Users SELECT self policy
12. **1.12** - User provisioning trigger

Apply all with: `supabase db push`

---

## Additional Resources

- **Phase 1 Completion Checklist:** See `docs/phase1-completion-checklist.md` for comprehensive pre-deployment verification
- **UI Balance Smoke Test:** See `server/scripts/uiBalanceSmoke.md` for frontend testing guide
- **Backup Guide:** See `docs/db-backup-and-rls.md` for backup procedures


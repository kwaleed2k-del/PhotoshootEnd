# Phase 1 Completion Checklist

## Pre-Deployment Verification

### 1. Policy Verification

**Check users and credit_transactions policies:**
```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('users','credit_transactions')
ORDER BY tablename, policyname;
```

**Expected:**
- ✅ `users_select_self` (SELECT only) on `users` table
- ✅ `credit_tx_select_self` (SELECT only) on `credit_transactions` table
- ✅ `credit_tx_service_insert/update/delete` (service role writes) on `credit_transactions`
- ❌ **NO** `credit_tx_insert_self` (client insert policy removed in Migration 1.10)

### 2. RPC Function Permissions

**Check RPC grants (should be service_role only):**
```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema='public'
  AND routine_name IN ('fn_add_credits','fn_deduct_credits','fn_refund_credits','fn_log_generation')
ORDER BY routine_name, grantee;
```

**Expected:**
- ✅ Only `grantee = 'service_role'` with `privilege_type = 'EXECUTE'` for all functions
- ❌ **NO** `grantee = 'public'` or `grantee = 'authenticated'`

### 3. Backup Before Deploy

**Create manual snapshot:**
```bash
pg_dump --dbname $SUPABASE_DB_URL --format=custom --file="backups/$(date +%Y%m%d-%H%M)-siyada.dump"
```

**Verify:**
- [ ] Backup file created and non-zero size
- [ ] Supabase managed backup timestamp confirmed in dashboard

## Critical Gotchas

### User Row Provisioning

**⚠️ IMPORTANT:** Ensure `public.users.id` equals `auth.users.id` (Supabase Auth user ID) for every user.

**Verification:**
```sql
-- Check if any auth users don't have a corresponding public.users row
SELECT au.id AS auth_id, au.email
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
```

**If rows are missing:**
- Create a database trigger or server-side handler to auto-create `public.users` row on signup
- Or manually sync existing auth users to `public.users` table

**Example trigger (if needed):**
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

### Service Role Key Security

- ✅ **Server-side only:** `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser
- ✅ **Client uses anon key:** Browser code uses `VITE_SUPABASE_ANON_KEY` only
- ✅ **No RPC calls from client:** All credit ledger operations via server endpoints

### Frontend Read-Only Pattern

**Client-side reads (safe):**
```typescript
// ✅ CORRECT: Read user balance (RLS-protected)
const { data } = await supabase
  .from('users')
  .select('credits_balance')
  .eq('id', user.id)
  .single();

// ✅ CORRECT: Read transaction history (RLS-protected)
const { data } = await supabase
  .from('credit_transactions')
  .select('*')
  .eq('user_id', user.id);
```

**Server-side writes (required):**
```typescript
// ✅ CORRECT: Server calls RPC with service role
import { supabaseAdmin } from './supabaseAdmin';
await supabaseAdmin.rpc('fn_add_credits', { ... });

// ❌ WRONG: Never call RPCs from client
await supabase.rpc('fn_add_credits', { ... }); // Will fail - no EXECUTE grant
```

## Post-Deployment Verification

### 1. Apply All Migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 2. Run Verification Queries

Execute the SQL queries from sections 1 and 2 above.

### 3. Test UI Components

1. Sign in as a test user
2. Navigate to billing page or header widget
3. Verify balance displays correctly
4. Open history modal
5. Test filters (type, days)
6. Verify refresh button works

### 4. Run Smoke Tests

```bash
# Service-role backed (should still work)
TEST_USER_ID=<uuid> tsx server/scripts/creditSmoke.ts
TEST_USER_ID=<uuid> tsx server/scripts/generationSmoke.ts
```

### 5. Network Verification

**Open browser DevTools → Network tab:**
- [ ] Only SELECT queries from client
- [ ] No INSERT/UPDATE/DELETE from client
- [ ] No RPC calls from client
- [ ] All reads return 200 OK (RLS working)

## Phase 1 Migration Summary

All migrations applied in order:
1. ✅ 1.1 - Extend users table
2. ✅ 1.2 - Create credit_transactions
3. ✅ 1.3 - Create subscription_history
4. ✅ 1.4 - Create credit_packages
5. ✅ 1.5 - Create billing_events
6. ✅ 1.6 - Extend user_generations
7. ✅ 1.7 - Create usage_analytics
8. ✅ 1.8 - RLS hardening & indexes
9. ✅ 1.9 - Credit ledger RPCs
10. ✅ 1.10 - Security & RPC grants
11. ✅ 1.11 - Users SELECT self policy

## Ready to Ship ✅

- [ ] All migrations applied
- [ ] Policies verified
- [ ] RPC grants verified
- [ ] Backup created
- [ ] User provisioning verified
- [ ] UI components tested
- [ ] Smoke tests pass
- [ ] Network calls verified (read-only from client)


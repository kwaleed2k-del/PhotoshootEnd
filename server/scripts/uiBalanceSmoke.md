# UI Credit Balance Smoke Test

## Quick SQL Checks

Run these queries in Supabase SQL Editor (as the authenticated user):

### 1. User Data Check

```sql
-- Expect one row (self) from users
SELECT id, credits_balance, subscription_plan, subscription_status
FROM public.users
WHERE id = auth.uid();
```

**Expected:** Returns exactly one row with your user's data.

### 2. Credit Transactions Check

```sql
-- Expect recent credit transactions (if any)
SELECT 
  created_at,
  transaction_type,
  amount,
  balance_after,
  description
FROM public.credit_transactions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Returns up to 5 most recent transactions for your user.

## Manual Test Flow

### Prerequisites
- User is signed in
- User has at least one credit transaction (run `creditSmoke.ts` if needed)

### Steps

1. **Navigate to Billing Page**
   - Open the page with `CreditBalance` component (e.g., `/billing` or header widget)
   - Verify balance displays correctly

2. **Verify Balance Matches SQL**
   - Compare `credits_balance` shown in UI with SQL query result
   - Should match exactly

3. **Check Plan Badge**
   - Verify plan name displays correctly
   - Verify plan color matches tier

4. **Test Low Credit Warning**
   - If balance < 10, verify yellow warning banner appears
   - If balance ≥ 10, verify no warning

5. **Open History Modal**
   - Click "View History" button
   - Modal should open

6. **Verify Transaction List**
   - Transactions should be in reverse-chronological order (newest first)
   - Verify transaction types display correctly
   - Verify amounts show correct sign (+ for additions, - for deductions)
   - Verify balance_after shows running balance

7. **Test Type Filter**
   - Select "usage" from type dropdown
   - Verify only usage transactions are shown
   - Select "all" to reset

8. **Test Days Filter**
   - Select "Last 7 days"
   - Verify only transactions from last 7 days are shown
   - Select "All time" to reset

9. **Test Refresh**
   - Click refresh button
   - Balance should reload (spinner should appear briefly)

10. **Verify Network Calls**
    - Open browser DevTools → Network tab
    - Verify only SELECT queries are made
    - Verify no INSERT/UPDATE/DELETE calls
    - Verify RLS is working (no permission errors)

## Expected Behavior

- ✅ Balance matches database value
- ✅ Plan badge displays correctly
- ✅ Low credit warning appears when balance < 10
- ✅ History modal shows transactions correctly
- ✅ Filters work as expected
- ✅ Refresh updates balance
- ✅ No write operations from client
- ✅ All reads pass RLS (no permission errors)

## Troubleshooting

**Balance doesn't load:**
- Check RLS policy `users_select_self` exists
- Verify user is authenticated (`auth.uid()` is not null)
- Check browser console for errors

**History doesn't load:**
- Check RLS policy `credit_tx_select_self` exists
- Verify user has transactions in database
- Check browser console for errors

**Permission errors:**
- Verify migrations 1.2 and 1.12 are applied
- Check RLS policies are enabled on tables
- Verify user is authenticated


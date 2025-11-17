# Migration Plan: SaaS Transformation Database Changes

**Date:** 2024  
**Repository:** Lenci Studio  
**Purpose:** Safe migration strategy for implementing PRD database changes

---

## Executive Summary

This document outlines the migration strategy for implementing the database schema changes described in `SAAS_TRANSFORMATION_PRD.md`. The current codebase uses **Supabase (PostgreSQL)** with **raw SQL files** and **no ORM**. The recommended approach is to use **Supabase Migrations** for version-controlled, reversible database changes.

---

## Current State Analysis

### Current Data Layer
- **Database:** Supabase PostgreSQL
- **Migration Tool:** None (single `database-schema.sql` file)
- **ORM:** None (direct Supabase client usage)
- **Schema Management:** Manual SQL execution

### Current Schema
- `users` - Basic user table (id, email, plan, generations_used)
- `user_generations` - Generation tracking (not currently populated)
- `user_models` - Custom AI models
- `user_apparel` - Apparel items
- `user_scenes` - Scene configurations

### Target Schema (from PRD)
The PRD requires extensive schema changes:
1. **Extended `users` table** - Add credits, subscription fields, Stripe IDs
2. **New `credit_transactions` table** - Track all credit movements
3. **New `subscription_history` table** - Track subscription changes
4. **New `credit_packages` table** - Define purchasable credit packages
5. **New `billing_events` table** - Track Stripe webhook events
6. **Updated `user_generations` table** - Add credits_used, credit_transaction_id
7. **New `usage_analytics` table** - Daily usage metrics

---

## Recommended Migration Tool: Supabase Migrations

### Why Supabase Migrations?

1. **Native Integration:** Already using Supabase, migrations are built-in
2. **Version Control:** SQL files in `supabase/migrations/` directory
3. **Rollback Support:** Can revert migrations if needed
4. **No ORM Required:** Works with existing raw SQL approach
5. **Team Collaboration:** Migrations are tracked and shareable
6. **Production Ready:** Supabase handles migration execution safely

### Setup Steps

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Initialize Migrations:**
   ```bash
   supabase init
   ```

3. **Link to Project:**
   ```bash
   supabase link --project-ref zkqycjedtxggvsncdpus
   ```

4. **Create Migration:**
   ```bash
   supabase migration new saas_transformation_phase1
   ```

---

## Migration Strategy: Phased Approach

### Phase 1: Non-Breaking Schema Extensions (Week 1)

**Goal:** Add new columns and tables without breaking existing functionality.

#### Migration 1.1: Extend `users` Table

**Migration File:** `supabase/migrations/20240101000000_extend_users_table_saas.sql`

**Description:** Extends the `users` table (public schema, NOT auth.users) with credit system, subscription management, and Stripe integration fields. This is a non-breaking migration that adds new columns with safe defaults.

**Changes:**
- Adds `credits_balance` and `credits_total_purchased` columns (INTEGER, default 0)
- Adds `subscription_plan` column (TEXT, default 'free') with CHECK constraint
- Adds `subscription_status` column (TEXT, default 'trialing') with CHECK constraint
- Adds `subscription_start_date` and `subscription_end_date` columns (TIMESTAMPTZ, nullable)
- Adds `billing_email` column (TEXT, nullable)
- Adds `stripe_customer_id` and `stripe_subscription_id` columns (TEXT, nullable)
- Creates partial unique indexes on Stripe ID columns (unique only when NOT NULL)

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK section. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   -- Drop partial unique indexes
   DROP INDEX IF EXISTS users_stripe_subscription_id_uidx;
   DROP INDEX IF EXISTS users_stripe_customer_id_uidx;
   
   -- Drop CHECK constraints
   ALTER TABLE users DROP CONSTRAINT IF EXISTS check_subscription_status;
   ALTER TABLE users DROP CONSTRAINT IF EXISTS check_subscription_plan;
   
   -- Drop columns
   ALTER TABLE users DROP COLUMN IF EXISTS stripe_subscription_id;
   ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
   ALTER TABLE users DROP COLUMN IF EXISTS billing_email;
   ALTER TABLE users DROP COLUMN IF EXISTS subscription_end_date;
   ALTER TABLE users DROP COLUMN IF EXISTS subscription_start_date;
   ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
   ALTER TABLE users DROP COLUMN IF EXISTS subscription_plan;
   ALTER TABLE users DROP COLUMN IF EXISTS credits_total_purchased;
   ALTER TABLE users DROP COLUMN IF EXISTS credits_balance;
   ```

**Risk Level:** Low  
**Rollback:** Safe - all operations use `IF EXISTS` guards

#### Migration 1.2: Create `credit_transactions` Table

**Migration File:** `supabase/migrations/20240102000000_create_credit_transactions_table.sql`

**Description:** Creates the `credit_transactions` table to track all credit movements (purchases, usage, refunds, grants, expiration, monthly resets). This table is essential for the credit-based billing system.

**References:**
- `user_id` references `public.users(id)` ON DELETE CASCADE
- `related_generation_id` references `public.user_generations(id)` ON DELETE SET NULL
  - **Note:** Detected PK type: `public.user_generations.id` is UUID, so `related_generation_id` uses UUID

**Changes:**
- Creates `credit_transactions` table with all required columns
- Adds CHECK constraint for `transaction_type` (purchase, usage, refund, grant, expiration, monthly_reset)
- Adds CHECK constraint for `amount` (must not be zero - positive for additions, negative for deductions)
- Creates composite index on `(user_id, created_at DESC)` for efficient user transaction queries
- Creates index on `transaction_type` for filtering by type
- Enables Row Level Security (RLS) with minimal policies (light touch - will refine in later RLS pass)
  - Users can SELECT their own transactions
  - Users can INSERT their own transactions

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK section. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   -- Drop RLS policies
   DROP POLICY IF EXISTS "credit_tx_insert_self" ON public.credit_transactions;
   DROP POLICY IF EXISTS "credit_tx_select_self" ON public.credit_transactions;
   
   -- Drop indexes
   DROP INDEX IF EXISTS credit_tx_type_idx;
   DROP INDEX IF EXISTS credit_tx_user_created_idx;
   
   -- Drop table (this will also drop constraints and foreign keys)
   DROP TABLE IF EXISTS public.credit_transactions;
   
   COMMIT;
   ```

**Risk Level:** Low (new table, no existing data)  
**Rollback:** Safe - all operations use `IF EXISTS` guards and are wrapped in a transaction

#### Migration 1.3: Create `subscription_history` Table

**Migration File:** `supabase/migrations/20240103000000_create_subscription_history_table.sql`

**Description:** Creates the `subscription_history` table to record historical subscription lifecycle events (plan changes, cancellations, past-due periods) for each user. The table references `public.users` (not `auth.users`) and stays aligned with `users.subscription_status` enum values.

**Changes:**
- Creates `subscription_history` table with UUID PK and timestamps
- Adds CHECK constraint `check_subscription_history_status` ensuring status is one of `active`, `canceled`, `past_due`, `trialing`
- Adds indexes on `(user_id, start_date DESC)` and `stripe_subscription_id` for efficient queries and Stripe lookups
- Enables Row Level Security and adds minimal SELECT policy (`subhist_select_self`) so users can view their own history (write operations handled by service role/webhooks)

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   DROP POLICY IF EXISTS "subhist_select_self" ON public.subscription_history;
   DROP INDEX IF EXISTS subscription_history_stripe_idx;
   DROP INDEX IF EXISTS subscription_history_user_idx;
   DROP TABLE IF EXISTS public.subscription_history;
   
   COMMIT;
   ```

**Risk Level:** Low (new table, no existing data)  
**Rollback:** Safe - guarded by `IF EXISTS` and wrapped in a transaction

#### Migration 1.4: Create `credit_packages` Table

**Migration File:** `supabase/migrations/20240104000000_create_credit_packages_table.sql`

**Description:** Introduces the `credit_packages` table that defines purchasable credit bundles for one-time purchases. No seed data is included; these packages will be managed via the admin UI later.

**Changes:**
- Creates `credit_packages` table with UUID primary key, pricing fields, and metadata
- Adds partial unique index `credit_packages_stripe_price_uidx` ensuring each Stripe price ID is unique when present
- Adds index `credit_packages_active_idx` for efficient queries on active packages
- Enables Row Level Security and adds minimal SELECT policy allowing anyone to read active packages (`credit_packages_select_active`)

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   DROP POLICY IF EXISTS "credit_packages_select_active" ON public.credit_packages;
   DROP INDEX IF EXISTS credit_packages_active_idx;
   DROP INDEX IF EXISTS credit_packages_stripe_price_uidx;
   DROP TABLE IF EXISTS public.credit_packages;
   
   COMMIT;
   ```

**Risk Level:** Low (new table, no existing data)  
**Rollback:** Safe - all operations use `IF EXISTS` guards and are wrapped in a transaction

#### Migration 1.5: Create `billing_events` Table

**Migration File:** `supabase/migrations/20240105000000_create_billing_events_table.sql`

**Description:** Creates the `billing_events` table to persist Stripe webhook events (invoices, payments, refunds, chargebacks) tied to each user. References `public.users` (not `auth.users`).

**Changes:**
- Creates `billing_events` table with UUID primary key, Stripe event ID, monetary fields, and JSON metadata
- Adds CHECK constraint `check_billing_events_type` ensuring event types match the approved enum (`invoice_created`, `payment_succeeded`, `payment_failed`, `refund`, `chargeback`)
- Adds indexes for `(user_id, created_at DESC)` and `event_type`
- Enables Row Level Security with minimal SELECT policy (`billing_events_select_self`) so users can read their own events (webhooks run with service role for inserts)

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   DROP POLICY IF EXISTS "billing_events_select_self" ON public.billing_events;
   DROP INDEX IF EXISTS billing_events_event_type_idx;
   DROP INDEX IF EXISTS billing_events_user_created_idx;
   DROP TABLE IF EXISTS public.billing_events;
   
   COMMIT;
   ```

**Risk Level:** Low (new table, no existing data)  
**Rollback:** Safe - all operations use `IF EXISTS` guards and are wrapped in a transaction

#### Migration 1.6: Extend `user_generations` with Credit Tracking

**Migration File:** `supabase/migrations/20240106000000_extend_user_generations_credits.sql`

**Description:** Adds credit bookkeeping fields to `public.user_generations`, linking each generation to a credit transaction and tracking credits consumed.

**Changes:**
- Adds `credits_used` (INTEGER, default 0) and `credit_transaction_id` (UUID) columns
- Adds FK constraint `user_generations_credit_tx_fk` to `public.credit_transactions(id)` (guarded so it only runs when the table exists)
- Adds CHECK constraint `chk_user_generations_credits_nonnegative` to prevent negative credit counts
- Ensures composite index `user_generations_user_created_idx` on `(user_id, created_at DESC)` exists

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   ALTER TABLE public.user_generations DROP CONSTRAINT IF EXISTS user_generations_credit_tx_fk;
   ALTER TABLE public.user_generations DROP CONSTRAINT IF EXISTS chk_user_generations_credits_nonnegative;
   ALTER TABLE public.user_generations DROP COLUMN IF EXISTS credit_transaction_id;
   ALTER TABLE public.user_generations DROP COLUMN IF EXISTS credits_used;
   DROP INDEX IF EXISTS user_generations_user_created_idx;
   
   COMMIT;
   ```

**Risk Level:** Low (adds nullable FK and defaulted columns)  
**Rollback:** Safe - guarded operations with `IF EXISTS`

#### Migration 1.7: Create `usage_analytics` Table

**Migration File:** `supabase/migrations/20240107000000_create_usage_analytics_table.sql`

**Description:** Adds the `usage_analytics` table to store daily aggregate metrics per user and generation type (e.g., apparel, product, video). Supports upserts and time-series reporting.

**Changes:**
- Creates `usage_analytics` table with UUID primary key, defaulted counters, and timestamp metadata
- Adds unique composite index `usage_analytics_unique_day` on `(user_id, date, generation_type)` for conflict-free upserts
- Adds supporting index `usage_analytics_user_date_idx` on `(user_id, date DESC)` for fast chart queries
- Enables Row Level Security with SELECT policy `usage_analytics_select_self` so users can view their own aggregates

**How to Apply:**
```bash
# Ensure Supabase CLI is installed and project is linked
supabase link --project-ref zkqycjedtxggvsncdpus

# Apply the migration
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect to your Supabase database via SQL Editor or psql
2. Execute the rollback SQL from the migration file (uncomment the ROLLBACK section):
   ```sql
   BEGIN;
   
   DROP POLICY IF EXISTS "usage_analytics_select_self" ON public.usage_analytics;
   DROP INDEX IF EXISTS usage_analytics_user_date_idx;
   DROP INDEX IF EXISTS usage_analytics_unique_day;
   DROP TABLE IF EXISTS public.usage_analytics;
   
   COMMIT;
   ```

**Risk Level:** Low (new table, no existing data)  
**Rollback:** Safe - guarded by `IF EXISTS` and wrapped in a transaction

#### Migration 1.8: RLS Hardening & Helper Indexes

**Migration File:** `supabase/migrations/20240108000000_rls_hardening_and_indexes.sql`

**Description:** Finalizes Phase-1 by ensuring the `pgcrypto` extension, adding helper indexes, and tightening Row Level Security so only the service role can perform writes while users retain read access.

**Changes:**
- Ensures `pgcrypto` extension is enabled (required for UUID generation in future work)
- Adds missing indexes: `credit_tx_related_gen_idx`, `user_generations_credit_tx_idx`, `subscription_history_user_idx`, `subscription_history_stripe_idx`
- Adds service-role write policies across key tables: `credit_transactions`, `billing_events`, `subscription_history`, `usage_analytics`, `credit_packages`

**How to Apply:**
```bash
supabase db push
```

**How to Rollback:**
The migration file includes a commented rollback block. To rollback manually:

1. Connect via Supabase SQL editor or `psql`
2. Execute the rollback SQL (uncomment the section):
   ```sql
   BEGIN;
   DROP POLICY IF EXISTS "credit_packages_service_delete" ON public.credit_packages;
   DROP POLICY IF EXISTS "credit_packages_service_update" ON public.credit_packages;
   DROP POLICY IF EXISTS "credit_packages_service_insert" ON public.credit_packages;
   DROP POLICY IF EXISTS "usage_analytics_service_update" ON public.usage_analytics;
   DROP POLICY IF EXISTS "usage_analytics_service_insert" ON public.usage_analytics;
   DROP POLICY IF EXISTS "subhist_service_insert" ON public.subscription_history;
   DROP POLICY IF EXISTS "billing_events_service_insert" ON public.billing_events;
   DROP POLICY IF EXISTS "credit_tx_service_delete" ON public.credit_transactions;
   DROP POLICY IF EXISTS "credit_tx_service_update" ON public.credit_transactions;
   DROP POLICY IF EXISTS "credit_tx_service_insert" ON public.credit_transactions;
   DROP INDEX IF EXISTS subscription_history_stripe_idx;
   DROP INDEX IF EXISTS subscription_history_user_idx;
   DROP INDEX IF EXISTS user_generations_credit_tx_idx;
   DROP INDEX IF EXISTS credit_tx_related_gen_idx;
   COMMIT;
   ```

**Risk Level:** Low (idempotent; only adds indexes/policies)  
**Rollback:** Safe—drops newly added policies/indexes only

#### Migration 1.9: Credit Ledger RPC Functions

**Migration File:** `supabase/migrations/20240109000000_credit_ledger_functions.sql`

**Description:** Creates three SECURITY DEFINER functions for atomic credit balance management. These functions ensure transaction safety and prevent race conditions when updating user balances.

**Functions:**

1. **`fn_add_credits(p_user_id, p_amount, p_description, p_tx_type, p_generation_id)`**
   - Adds credits to a user's balance atomically
   - Valid transaction types: `purchase`, `grant`, `refund`, `monthly_reset`
   - Returns: `transaction_id` (UUID), `balance_after` (INTEGER)

2. **`fn_deduct_credits(p_user_id, p_amount, p_description, p_generation_id)`**
   - Deducts credits from a user's balance atomically
   - Raises error code **P3001** if insufficient credits
   - Returns: `transaction_id` (UUID), `balance_after` (INTEGER)

3. **`fn_refund_credits(p_user_id, p_transaction_id, p_reason)`**
   - Refunds credits based on a previous transaction
   - Validates transaction ownership
   - Returns: `refund_transaction_id` (UUID), `balance_after` (INTEGER)

**Error Codes:**
- **P3001**: Insufficient credits (raised by `fn_deduct_credits`)
- **P0001**: Invalid amount (must be positive)
- **P0002**: Invalid transaction type
- **P0003**: User not found
- **P0004**: Transaction not found
- **P0005**: Transaction ownership mismatch

**How to Apply:**
```bash
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

```sql
DROP FUNCTION IF EXISTS public.fn_refund_credits(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.fn_deduct_credits(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.fn_add_credits(UUID, INTEGER, TEXT, TEXT, UUID);
```

**Risk Level:** Low (adds functions only, no schema changes)  
**Rollback:** Safe—functions can be dropped without data loss

**TypeScript Service:**
- `server/services/supabaseAdmin.ts` - Service role client
- `server/services/creditService.ts` - Wrapper functions with typed interfaces
- `server/scripts/creditSmoke.ts` - Smoke test script

---

## Credit Cost Configuration

**Location:** `src/constants/creditCosts.ts`

**Purpose:** Defines base credit costs per generation type and plan-specific overrides. Aligns with PRD values.

### Base Costs (from PRD)
- **Apparel Generation:** 2 credits per image
- **Product Generation:** 1 credit per image
- **Video Generation:** 5 credits per video
- **Multiple images:** Credits × number of images

### Configuration

**`BASE_CREDIT_COSTS`:** Base costs per generation type (apparel, product, video)

**`PLAN_COST_RULES`:** Plan-specific rules allowing:
- `overrides`: Per-generation-type cost overrides
- `multiplier`: Global multiplier applied after overrides
- `unlimited`: Set to `true` for enterprise plan (returns 0 credits)

**`computeCreditCost(plan, type, count)`:** Main function that:
- Returns `0` for enterprise plan (unlimited credits per PRD)
- Applies plan-specific overrides if present
- Applies multiplier if present
- Multiplies by count and rounds to integer
- Throws error for unknown generation types

### Server Wrapper

**`server/services/creditCostService.ts`:** Thin wrapper `costForGeneration()` that:
- Normalizes invalid counts to 1 (with warning log)
- Calls `computeCreditCost()` internally

### Smoke Test

**`server/scripts/creditCostSmoke.ts`:** Prints a cost matrix showing:
- Costs per plan tier for apparel (×1, ×3), product (×1, ×4), video (×1)
- Enterprise plan shows `0 (unlimited)` for all operations

---

## Credit Pre-Check Middleware

**Location:** `server/middleware/creditPrecheck.ts`

**Purpose:** Wraps generation handlers to ensure users have sufficient credits before processing, deduct credits atomically, and auto-refund on failure.

### How It Works

**`withCreditGuard(userId, opts, work)`** or **`createCreditGuard(userId)`** wrapper:

1. **Resolves user plan and balance** from `public.users` table (subscription_plan, credits_balance)
2. **Computes required credits** using `costForGeneration(plan, type, count)`
3. **Checks sufficient credits** (skips for enterprise/unlimited plans)
4. **Deducts credits atomically** using `fn_deduct_credits` RPC before generation starts
5. **Executes work function** (your generation pipeline)
6. **Auto-refunds on failure** (unless `autoRefundOnFailure: false`) using `fn_refund_credits` RPC

### Error Response Shape

When `ok: false`, the result includes:
- **`code`**: `'INSUFFICIENT_CREDITS' | 'PLAN_BLOCKED' | 'UNKNOWN'`
- **`message`**: Human-readable error message
- **`needed`**: Required credits (for INSUFFICIENT_CREDITS)
- **`have`**: Current balance (for INSUFFICIENT_CREDITS)
- **`purchaseHintUrl`**: URL to purchase credits (default: `/billing/credits`)

### Example Handlers

**`server/handlers/generateApparel.ts`**, **`generateProduct.ts`**, **`generateVideo.ts`**:
- Stub handlers showing how to wrap generation logic with credit guard
- Returns `402 Payment Required` for insufficient credits
- Returns `200 OK` with generation data on success
- Includes `reservation` object with `transactionId` for linking to `user_generations.credit_transaction_id`

### Helper Functions

**`isLowCredit(balance)`**: Returns `true` if balance < 10 (for UI warnings)

**`resolveUserPlanAndBalance(userId)`**: Internal helper that reads user plan and balance from database

---

## Credit Usage Tracking

**Location:** `supabase/migrations/20240110000000_generation_logging_functions.sql`, `server/services/generationTrackingService.ts`

**Purpose:** Atomic function to log successful generations, link credit transactions, and update daily usage analytics. Aligned to PRD Task 2.5.

### Function: `fn_log_generation`

**Parameters:**
- `p_user_id` (UUID): User ID
- `p_type` (TEXT): Generation type ('apparel', 'product', 'video')
- `p_credits_used` (INTEGER): Credits consumed (0 for enterprise/unlimited)
- `p_credit_tx_id` (UUID): Credit transaction ID (NULL for enterprise/unlimited)
- `p_prompt` (TEXT): Generation prompt
- `p_settings` (JSONB): Generation settings
- `p_result_urls` (TEXT[]): Array of image/video URLs
- `p_count` (INTEGER): Number of images (1 for video)

**Returns:** `generation_id` (UUID)

**Atomic Operations:**
1. **Inserts** into `user_generations` with `credits_used` and `credit_transaction_id`
2. **Updates** `credit_transactions.related_generation_id` to link the transaction (if provided)
3. **Upserts** `usage_analytics` for today, incrementing `count` and `credits_used`

### Service: `logGenerationSuccess()`

**Location:** `server/services/generationTrackingService.ts`

**Usage:** Called from generation handlers after successful generation, inside the `withCreditGuard` success path.

**Enterprise/Unlimited Plan Handling:**
- When `creditsUsed = 0` and `creditTransactionId = undefined` (enterprise plan)
- Still logs generation and increments analytics
- `credits_used` in analytics remains 0
- `credit_transaction_id` in `user_generations` is NULL

### Handler Integration

All three handlers (`generateApparel`, `generateProduct`, `generateVideo`) call `logGenerationSuccess()` after generating outputs:
- Links `reservation.transactionId` to the generation record
- Passes `reservation.creditsUsed` for accurate tracking
- Updates daily analytics automatically

#### Migration 1.10: Security & RPC Grants

**Migration File:** `supabase/migrations/20240111000000_security_and_rpc_grants.sql`

**Description:** Hardens security by removing client insert policy on credit transactions and locking down RPC functions to service role only.

**Changes:**
- Ensures `pgcrypto` extension exists (idempotent)
- Removes `credit_tx_insert_self` policy (end-users can no longer insert credit transactions directly)
- Revokes PUBLIC execute grants on all credit ledger and generation logging RPC functions
- Grants EXECUTE to `service_role` only for:
  - `fn_add_credits`
  - `fn_deduct_credits`
  - `fn_refund_credits`
  - `fn_log_generation`
- Sets function owners to `postgres` (ensures SECURITY DEFINER runs with correct privileges)

**Security Rationale:**
- Credit ledger operations must be server-controlled to prevent manipulation
- RPC functions are SECURITY DEFINER and should only be called by trusted service code
- End-users can still read their own credit transactions via `credit_tx_select_self` policy

**How to Apply:**
```bash
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

1. Connect via Supabase SQL editor or `psql`
2. Execute the rollback SQL (uncomment the section):
   ```sql
   -- Restore function owners (adjust to original owner if different)
   ALTER FUNCTION public.fn_log_generation(...) OWNER TO <original_owner>;
   ALTER FUNCTION public.fn_refund_credits(...) OWNER TO <original_owner>;
   ALTER FUNCTION public.fn_deduct_credits(...) OWNER TO <original_owner>;
   ALTER FUNCTION public.fn_add_credits(...) OWNER TO <original_owner>;
   
   -- Revoke service role grants
   REVOKE EXECUTE ON FUNCTION public.fn_log_generation(...) FROM service_role;
   REVOKE EXECUTE ON FUNCTION public.fn_refund_credits(...) FROM service_role;
   REVOKE EXECUTE ON FUNCTION public.fn_deduct_credits(...) FROM service_role;
   REVOKE EXECUTE ON FUNCTION public.fn_add_credits(...) FROM service_role;
   
   -- Re-add client insert policy (not recommended for security)
   -- CREATE POLICY "credit_tx_insert_self"
   --   ON public.credit_transactions FOR INSERT
   --   WITH CHECK (auth.uid() = user_id);
   ```

**Risk Level:** Low (security hardening, no data changes)  
**Rollback:** Safe—reverses permission changes only

**Verification:**
- See detailed verification checklist in `docs/migration-verification-checklist.md`
- Quick checks:
  - Policies: `SELECT * FROM pg_policies WHERE tablename = 'credit_transactions'` (should not show `credit_tx_insert_self`)
  - RPC privileges: See verification query in `docs/db-backup-and-rls.md` "RPC Permissions" section
  - Smoke tests: `creditSmoke.ts` and `generationSmoke.ts` should still pass (they use service role)

#### Migration 1.11: Users SELECT Self Policy

**Migration File:** `supabase/migrations/20240112000000_users_select_self_policy.sql`

**Description:** Adds read-only SELECT policy to `public.users` table, allowing authenticated users to read their own user record via RLS. Required for client-side credit balance display.

**Changes:**
- Ensures RLS is enabled on `public.users` (idempotent)
- Creates `users_select_self` policy allowing users to SELECT their own row where `auth.uid() = id`
- Read-only policy (no INSERT/UPDATE permissions granted here)

**How to Apply:**
```bash
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

```sql
DROP POLICY IF EXISTS "users_select_self" ON public.users;
```

**Risk Level:** Low (read-only policy, no data changes)  
**Rollback:** Safe—drops policy only

#### Migration 1.12: User Provisioning Trigger

**Migration File:** `supabase/migrations/20240113000000_user_provisioning_trigger.sql`

**Description:** Automatically creates `public.users` row when `auth.users` row is created. Ensures `public.users.id = auth.users.id` immediately so RLS self-select policies work correctly.

**Changes:**
- Creates `handle_new_user()` SECURITY DEFINER function
- Creates trigger `on_auth_user_created` on `auth.users` INSERT
- Automatically provisions `public.users` row with default values (plan='free', credits=0)
- Uses `ON CONFLICT DO NOTHING` for idempotency

**How to Apply:**
```bash
supabase db push
```

**How to Rollback:**
The migration file includes a commented ROLLBACK block. To rollback manually:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

**Risk Level:** Low (adds trigger only, no data changes)  
**Rollback:** Safe—drops trigger and function only

**Verification:**
- Check trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created'`
- Test by creating a new auth user and verifying `public.users` row is created automatically

---

## UI 1.1: Credit Balance & History (Client + RLS)

**Location:** `src/components/billing/`, `src/pages/BillingOverview.tsx`

**Purpose:** User-facing components to display credit balance and transaction history. All reads are client-side via RLS policies.

### Components

**`CreditBalance.tsx`:**
- Displays current plan badge, credit balance, and low-credit warning
- Shows "View History" button (opens modal) and "Purchase Credits" CTA
- Fetches from `public.users` (requires `users_select_self` policy)
- Includes refresh button to reload balance
- Color-coded plan badges (free/starter/professional/enterprise)

**`CreditHistoryModal.tsx`:**
- Modal displaying last 50 credit transactions
- Reverse-chronological order with date, type, amount (+/−), balance_after, description
- Filters: transaction type dropdown, days filter (7/30/90 days, all time)
- Color-coded transaction types (green for additions, red for deductions, gray for resets)
- Empty state when no transactions found

**`BillingOverview.tsx` (Demo Page):**
- Standalone page demonstrating credit balance widget
- Can be embedded in header or used as full page

### Store (Optional)

**`src/context/billingStore.ts`:**
- Zustand store for caching credit balance
- Reduces redundant API calls
- Optional—components work without it

### Utilities

**`src/utils/credits.ts`:**
- `isLowCredit(balance)` - Returns true if balance < 10

### Data Access

**Read-Only via RLS:**
- Uses `services/supabaseClient.ts` (anon key) with user session
- Relies on RLS policies:
  - `users_select_self` (Migration 1.11) - allows reading own user record
  - `credit_tx_select_self` (Migration 1.2) - allows reading own transactions
- No service-role or RPC calls from client
- No write operations from client

### Security

- All reads pass through RLS (users can only see their own data)
- No client-side writes (all mutations via server RPCs)
- Network calls verified to only include SELECT queries

### Smoke Test

See `server/scripts/uiBalanceSmoke.md` for:
- SQL verification queries
- Manual test flow
- Troubleshooting guide

### Phase 2: Update Existing Tables (Week 2)

#### Migration 2.1: Update `user_generations` Table
```sql
-- Add new columns
ALTER TABLE user_generations 
  ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_transaction_id UUID REFERENCES credit_transactions(id) ON DELETE SET NULL;

-- Create index for credit_transaction_id
CREATE INDEX IF NOT EXISTS idx_generations_credit_transaction ON user_generations(credit_transaction_id);

-- Backfill credits_used for existing generations (estimate based on type)
UPDATE user_generations 
SET credits_used = CASE 
  WHEN generation_type = 'apparel' THEN 2
  WHEN generation_type = 'product' THEN 1
  WHEN generation_type = 'video' THEN 5
  ELSE 1
END
WHERE credits_used = 0;
```

**Risk Level:** Medium (touching existing table)  
**Rollback:** Can drop new columns

#### Migration 2.2: Create `usage_analytics` Table
```sql
CREATE TABLE IF NOT EXISTS usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  generation_type VARCHAR(50) NOT NULL,
  count INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date, generation_type)
);

CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_date ON usage_analytics(date);

ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage analytics" 
  ON usage_analytics FOR SELECT 
  USING (auth.uid() = user_id);
```

**Risk Level:** Low

### Phase 3: Data Migration & Backfill (Week 3)

#### Migration 3.1: Migrate Existing Plan Values
```sql
-- Map old plan values to new subscription_plan values
-- This should already be done in Migration 1.1, but ensure consistency
UPDATE users 
SET subscription_plan = CASE 
  WHEN plan = 'solo' THEN 'starter'
  WHEN plan = 'studio' THEN 'professional'
  WHEN plan = 'brand' THEN 'enterprise'
  ELSE 'free'
END
WHERE subscription_plan IS NULL OR subscription_plan = '';

-- Set initial credits based on plan (one-time grant)
INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
SELECT 
  id,
  'grant',
  CASE 
    WHEN subscription_plan = 'free' THEN 10
    WHEN subscription_plan = 'starter' THEN 100
    WHEN subscription_plan = 'professional' THEN 500
    WHEN subscription_plan = 'enterprise' THEN 1000
    ELSE 0
  END,
  CASE 
    WHEN subscription_plan = 'free' THEN 10
    WHEN subscription_plan = 'starter' THEN 100
    WHEN subscription_plan = 'professional' THEN 500
    WHEN subscription_plan = 'enterprise' THEN 1000
    ELSE 0
  END,
  'Initial credits granted for plan migration'
FROM users
WHERE credits_balance = 0 AND subscription_plan IS NOT NULL;

-- Update credits_balance based on transactions
UPDATE users u
SET credits_balance = COALESCE((
  SELECT SUM(amount) 
  FROM credit_transactions 
  WHERE user_id = u.id
), 0);
```

**Risk Level:** Medium (data transformation)  
**Rollback:** Can delete inserted transactions

---

## Risk Assessment

### High Risk Areas
1. **Existing User Data:** Migrating plan values and adding credits
   - **Mitigation:** Test on staging first, backup database before migration
   - **Rollback:** Can revert plan mappings and delete credit transactions

2. **RLS Policies:** New tables need proper RLS policies
   - **Mitigation:** Test policies thoroughly in staging
   - **Rollback:** Can drop policies if issues arise

3. **Foreign Key Constraints:** Adding FKs to existing tables
   - **Mitigation:** Use `ON DELETE SET NULL` for optional relationships
   - **Rollback:** Can drop constraints

### Medium Risk Areas
1. **Column Additions:** Adding columns to existing tables
   - **Mitigation:** Use `IF NOT EXISTS` and default values
   - **Rollback:** Can drop columns (data loss for new fields)

2. **Index Creation:** Adding indexes on large tables
   - **Mitigation:** Create indexes during low-traffic periods
   - **Rollback:** Can drop indexes

### Low Risk Areas
1. **New Tables:** Creating entirely new tables
   - **Mitigation:** Minimal risk, can drop if needed
   - **Rollback:** Simple `DROP TABLE` statements

---

## Rollback Procedures

### General Rollback Strategy

1. **Backup Before Migration:**
   ```sql
   -- Create backup of critical tables
   CREATE TABLE users_backup AS SELECT * FROM users;
   CREATE TABLE user_generations_backup AS SELECT * FROM user_generations;
   ```

2. **Rollback Scripts:** Create reverse migrations for each phase
   ```sql
   -- Example: Rollback Migration 1.1
   ALTER TABLE users 
     DROP COLUMN IF EXISTS credits_balance,
     DROP COLUMN IF EXISTS credits_total_purchased,
     DROP COLUMN IF EXISTS subscription_plan,
     -- ... etc
   ```

3. **Supabase Migration Rollback:**
   ```bash
   # List migrations
   supabase migration list
   
   # Revert to specific migration
   supabase migration repair --status reverted <migration_name>
   ```

### Phase-Specific Rollbacks

**Phase 1 Rollback:**
- Drop new columns from `users` table
- Drop new tables: `credit_transactions`, `subscription_history`, `credit_packages`, `billing_events`

**Phase 2 Rollback:**
- Drop new columns from `user_generations`
- Drop `usage_analytics` table

**Phase 3 Rollback:**
- Delete backfilled credit transactions
- Revert plan mappings (if needed)

---

## Testing Strategy

### Pre-Migration Testing

1. **Staging Environment:**
   - Create staging Supabase project
   - Run all migrations on staging first
   - Test application functionality

2. **Data Validation:**
   - Verify existing users are not broken
   - Check RLS policies work correctly
   - Validate foreign key constraints

3. **Performance Testing:**
   - Check index creation doesn't lock tables
   - Verify query performance after migrations

### Post-Migration Testing

1. **Functional Tests:**
   - User authentication still works
   - Generation tracking works
   - Credit system functions correctly

2. **Data Integrity:**
   - Verify no data loss
   - Check referential integrity
   - Validate RLS policies

---

## Migration Execution Plan

### Step-by-Step Execution

1. **Week 1: Setup & Phase 1**
   - Install Supabase CLI
   - Initialize migrations directory
   - Create Phase 1 migrations
   - Test on staging
   - Deploy to production

2. **Week 2: Phase 2**
   - Create Phase 2 migrations
   - Test on staging
   - Deploy to production

3. **Week 3: Phase 3**
   - Create Phase 3 migrations (data backfill)
   - Test on staging
   - Deploy to production during maintenance window

### Deployment Checklist

- [ ] Backup production database
- [ ] Test migrations on staging
- [ ] Review migration SQL for syntax errors
- [ ] Verify RLS policies
- [ ] Check foreign key constraints
- [ ] Test application after migration
- [ ] Monitor for errors post-deployment
- [ ] Have rollback plan ready

---

## Alternative Approaches (Not Recommended)

### Option 1: Continue with Manual SQL Files
**Pros:**
- No new tooling required
- Simple for small changes

**Cons:**
- No version control
- No rollback mechanism
- Difficult to track changes
- Error-prone for team collaboration

**Verdict:** ❌ Not recommended for production SaaS

### Option 2: Introduce Prisma
**Pros:**
- Type-safe database access
- Excellent migration tooling
- Great developer experience

**Cons:**
- Requires complete refactoring of data access layer
- Significant development time
- Learning curve for team
- Overkill for current needs

**Verdict:** ❌ Not recommended (too much refactoring)

### Option 3: Use Drizzle ORM
**Pros:**
- Lightweight ORM
- Good TypeScript support

**Cons:**
- Still requires refactoring
- Less mature than Prisma
- Additional dependency

**Verdict:** ❌ Not recommended (unnecessary complexity)

---

## Conclusion

**Recommended Approach:** Supabase Migrations

This approach:
- ✅ Works with existing stack (no refactoring)
- ✅ Provides version control and rollback
- ✅ Native to Supabase (no new dependencies)
- ✅ Safe and reversible
- ✅ Team-friendly

**Next Steps:**
1. Install Supabase CLI
2. Initialize migrations directory
3. Create Phase 1 migrations
4. Test on staging environment
5. Execute phased rollout to production

---

## Migration File Structure

```
supabase/
  migrations/
    20240101000000_saas_phase1_users.sql
    20240101000001_saas_phase1_credit_transactions.sql
    20240101000002_saas_phase1_subscription_history.sql
    20240101000003_saas_phase1_credit_packages.sql
    20240101000004_saas_phase1_billing_events.sql
    20240108000000_saas_phase2_user_generations.sql
    20240108000001_saas_phase2_usage_analytics.sql
    20240115000000_saas_phase3_data_migration.sql
```

Each migration file should be:
- Idempotent (can run multiple times safely)
- Reversible (has corresponding rollback)
- Tested on staging first


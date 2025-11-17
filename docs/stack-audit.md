# Stack Audit: Lenci Studio

**Date:** 2024  
**Repository:** Lenci Studio (siyada-studio)  
**Purpose:** Comprehensive technical stack analysis for SaaS transformation

---

## 1. Application Framework

### Framework & Build Tool
- **Framework:** React 19.1.1 (SPA, not Next.js)
- **Build Tool:** Vite 6.2.0
- **TypeScript:** 5.8.2 (strict mode enabled)
- **Package Manager:** npm (via package-lock.json)

### Architecture
- **Pattern:** Single Page Application (SPA)
- **Entry Point:** `index.tsx` → `App.tsx`
- **Routing:** Client-side routing (no Next.js App Router or Pages Router)
- **State Management:** Zustand 4.5.4 (context stores in `context/` directory)
- **UI Library:** React DOM 19.1.1

### Development Server
- **Server:** Vite dev server with custom middleware
- **Port:** 3000
- **Custom Routes:** Gemini API routes registered via Vite plugin (`server/geminiRoutes.ts`)
- **API Endpoints:**
  - `/api/health` - Health check
  - `/api/apparel/detect` - Apparel detection
  - `/api/imaging/process` - Image generation (Gemini)
  - `/api/openai/generate` - DALL-E 3 generation

---

## 2. Data Layer

### Database
- **Provider:** Supabase (PostgreSQL)
- **Instance:** `https://zkqycjedtxggvsncdpus.supabase.co`
- **Client Library:** `@supabase/supabase-js` 2.44.4
- **ORM:** None (raw SQL queries via Supabase client)

### Migration Tool
- **Current Approach:** Raw SQL files (`database-schema.sql`)
- **Migration System:** Manual SQL execution (no Prisma, Drizzle, or TypeORM)
- **Schema Management:** Single SQL file with `CREATE TABLE IF NOT EXISTS` statements

### Current Schema Overview

#### Core Tables

**`users`**
```sql
- id (UUID, PK)
- email (VARCHAR(255), UNIQUE, NOT NULL)
- plan (VARCHAR(50), CHECK: 'solo' | 'studio' | 'brand', DEFAULT 'solo')
- generations_used (INTEGER, DEFAULT 0)
- created_at (TIMESTAMP WITH TIME ZONE)
- updated_at (TIMESTAMP WITH TIME ZONE)
```

**`user_generations`**
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id, CASCADE DELETE)
- generation_type (VARCHAR(50), NOT NULL) -- 'apparel', 'product', 'design', 'video'
- prompt (TEXT)
- settings (JSONB) -- Generation settings
- result_urls (TEXT[]) -- Array of image/video URLs
- created_at (TIMESTAMP WITH TIME ZONE)
```

**`user_models`**
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id, CASCADE DELETE)
- name (VARCHAR(255), NOT NULL)
- description (TEXT)
- gender (VARCHAR(20), CHECK: 'Male' | 'Female')
- image_url (TEXT)
- is_public (BOOLEAN, DEFAULT FALSE)
- created_at (TIMESTAMP WITH TIME ZONE)
```

**`user_apparel`**
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id, CASCADE DELETE)
- name (VARCHAR(255), NOT NULL)
- category (VARCHAR(50), CHECK: 'Top' | 'Bottom' | 'Full Body' | 'Outerwear' | 'Accessory' | 'Footwear')
- description (TEXT)
- image_url (TEXT)
- created_at (TIMESTAMP WITH TIME ZONE)
```

**`user_scenes`**
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id, CASCADE DELETE)
- name (VARCHAR(255), NOT NULL)
- scene_config (JSONB, NOT NULL)
- is_public (BOOLEAN, DEFAULT FALSE)
- created_at (TIMESTAMP WITH TIME ZONE)
```

### Security
- **Row Level Security (RLS):** Enabled on all tables
- **Policies:** User-scoped access (users can only access their own data)
- **Auth Integration:** Uses `auth.uid()` for RLS policy checks

### Indexes
- `idx_users_email` on `users(email)`
- `idx_generations_user_id` on `user_generations(user_id)`
- `idx_generations_created_at` on `user_generations(created_at)`
- `idx_models_user_id` on `user_models(user_id)`
- `idx_apparel_user_id` on `user_apparel(user_id)`
- `idx_scenes_user_id` on `user_scenes(user_id)`

---

## 3. Authentication System

### Provider
- **System:** Supabase Auth (custom implementation)
- **Not Using:** NextAuth, Auth.js, Clerk, or other third-party auth providers
- **Client:** `services/supabaseClient.ts` (hardcoded Supabase URL and anon key)

### Authentication Methods
- Email/Password signup and signin (`authService.signUp`, `authService.signInWithEmail`)
- Google OAuth (`authService.signInWithGoogle`)
- Session management via Supabase (`authService.getSession`, `authService.getUser`)

### User Table Shape
**Current `users` table:**
- `id` (UUID) - Primary key, matches Supabase Auth `auth.users.id`
- `email` (VARCHAR(255), UNIQUE)
- `plan` (VARCHAR(50)) - Current plans: 'solo', 'studio', 'brand'
- `generations_used` (INTEGER) - Simple counter
- `created_at`, `updated_at` (TIMESTAMPS)

**Note:** The `users` table appears to be separate from Supabase's `auth.users` table, but RLS policies reference `auth.uid()`, suggesting integration with Supabase Auth.

### Auth Context
- **Location:** `context/AuthContext.tsx`
- **Current State:** Mock/demo implementation with hardcoded user
- **Real Auth:** `services/authService.ts` provides Supabase auth methods (not currently wired to context)

---

## 4. Generation Feature Code Paths

### Generation Types
1. **Apparel Generation** (Virtual Try-On)
   - Entry: `components/apparel/ApparelUploader.tsx`
   - Service: `services/professionalImagingService.ts`
   - API: `/api/imaging/process` (Gemini)
   - Store: `context/apparelStore.ts` (Zustand)

2. **Product Generation**
   - Entry: `components/product/ProductUploader.tsx`
   - Service: `services/professionalImagingService.ts`
   - API: `/api/imaging/process` (Gemini)
   - Store: `context/productStore.ts` (Zustand)

3. **Design Generation** (Mockups)
   - Entry: `components/design/DesignUploader.tsx`
   - Service: `services/professionalImagingService.ts`
   - API: `/api/imaging/process` or `/api/openai/generate` (DALL-E 3)
   - Store: `context/designStore.ts` (Zustand)

4. **Video Generation**
   - Entry: `components/video/VideoSourceUploader.tsx`
   - Store: `context/sharedStore.ts` (Zustand)
   - **Status:** Implementation appears incomplete

### Database Tracking
- **Table:** `user_generations`
- **Current Usage:** 
  - Schema includes `credits_used` and `credit_transaction_id` columns (Migration 1.6)
  - `fn_log_generation()` RPC function (Migration 1.10) atomically inserts generations
  - Handlers call `logGenerationSuccess()` after successful generation
- **Generation Flow:**
  1. User triggers generation via `components/shared/GenerateButton.tsx`
  2. Credit guard pre-checks and deducts credits (`server/middleware/creditPrecheck.ts`)
  3. Service calls API (`server/geminiRoutes.ts` or OpenAI)
  4. `logGenerationSuccess()` saves to `user_generations` with credit linkage
  5. Updates `usage_analytics` for daily aggregates

### Generation Counting
- **Current:** `users.generations_used` field exists (legacy, may be deprecated)
- **New:** Credit-based tracking via `credit_transactions` and `user_generations.credits_used`
- **UI:** Credit balance and history displayed via `src/components/billing/CreditBalance.tsx`
  - Reads from `credit_transactions` table (RLS-protected)
  - Shows transaction history with filters
  - Displays current balance and plan tier

---

## 5. Billing & Payments

### Current State
- **Stripe Integration:** ❌ Not implemented
- **Billing Code:** ❌ None found
- **Email Service:** ❌ Not implemented
- **Subscription Management:** ❌ Not implemented

### Planned (from PRD)
The `SAAS_TRANSFORMATION_PRD.md` describes extensive billing features:
- Stripe integration
- Credit system
- Subscription plans (free, starter, professional, enterprise)
- Credit packages
- Billing events tracking
- **Status:** All planned, none implemented

### Environment Variables
**Current `.env.local` usage:**
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key (for DALL-E 3)

**Expected for Billing (not yet used):**
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY` or `RESEND_API_KEY` (for emails)

---

## 6. Admin Surface

### Current State
- **Admin Routes:** ❌ None found
- **Admin Components:** ❌ None found
- **Admin Authentication:** ❌ Not implemented
- **Admin Dashboard:** ❌ Not implemented

### Planned (from PRD)
- User management
- Subscription management
- Credit management
- Analytics dashboard
- **Status:** All planned, none implemented

---

## 7. Routing Scheme

### Current Architecture
- **Type:** Client-side SPA routing (no Next.js)
- **Pattern:** Component-based navigation (conditional rendering in `App.tsx`)
- **Routes:**
  - `/` - Landing page or Studio (conditional)
  - `/login` - Login page (`login.tsx` entry point)
  - `/signup` - Signup page (`signup.tsx` entry point)

### Navigation Flow
1. **Landing Page:** `components/landing/LandingPage.tsx` (default view)
2. **Mode Selector:** `components/studio/StudioModeSelector.tsx` (when entering studio)
3. **Studio View:** `components/studio/StudioView.tsx` (main app interface)

### API Boundaries
- **Frontend:** React SPA
- **Backend:** Vite dev server middleware (`server/geminiRoutes.ts`)
- **External APIs:**
  - Google Gemini API (via `@google/genai`)
  - OpenAI API (via `openai` package)
  - Supabase API (via `@supabase/supabase-js`)

---

## 8. Testing Setup

### Current State
- **Test Framework:** ❌ None configured
- **Unit Tests:** ❌ No test files found
- **Integration Tests:** ❌ None found
- **E2E Tests:** ❌ None found
- **Test Files:** No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files

### Test Coverage
- **Coverage:** 0% (no tests exist)

### Planned (from PRD)
- Unit tests for services
- Integration tests for payment flows
- E2E tests for critical paths
- **Status:** Planned but not implemented

---

## 9. Infrastructure & Deployment

### Current State
- **Docker:** ❌ No Dockerfile or docker-compose.yml found
- **CI/CD:** ❌ No GitHub Actions, GitLab CI, or other CI/CD configs found
- **Monitoring:** ❌ No monitoring setup (Sentry, Datadog, etc.)
- **Logging:** ❌ No structured logging system

### Deployment Target
- **Current:** Unknown (likely manual deployment)
- **Build Output:** `dist/` directory (Vite build)
- **Static Assets:** `dist/assets/` (JS and CSS bundles)

### Development Scripts
- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `start-dev.bat` - Windows batch script for dev server

### Environment
- **OS:** Windows (based on `start-dev.bat`)
- **Node:** Version not specified in package.json
- **Package Manager:** npm

---

## 10. Key Dependencies

### Production Dependencies
- `react` ^19.1.1
- `react-dom` ^19.1.1
- `@supabase/supabase-js` ^2.44.4
- `@google/genai` ^1.15.0
- `openai` ^6.8.1
- `zustand` ^4.5.4
- `lucide-react` ^0.541.0
- `react-dropzone` ^14.3.8
- `dotenv` ^17.2.3

### Development Dependencies
- `typescript` ~5.8.2
- `vite` ^6.2.0
- `@vitejs/plugin-react` ^5.0.0
- `@types/node` ^22.14.0

---

## 11. Summary & Recommendations

### Current Stack Summary
- **Framework:** React SPA with Vite
- **Database:** Supabase (PostgreSQL) with raw SQL
- **Auth:** Supabase Auth (partially implemented)
- **ORM:** None (direct Supabase client usage)
- **Testing:** None
- **Billing:** Not implemented
- **Admin:** Not implemented
- **CI/CD:** Not implemented

### Critical Gaps for SaaS Transformation
1. **Migration Tool:** Need to choose between:
   - Supabase migrations (recommended)
   - Manual SQL files (current approach, not scalable)
   - Prisma (would require significant refactoring)

2. **Generation Tracking:** `user_generations` table exists but is not being populated

3. **Billing System:** Complete Stripe integration needed

4. **Testing:** No test infrastructure exists

5. **Admin Panel:** No admin interface exists

6. **CI/CD:** No deployment automation

---

## 12. Migration Tool Recommendation

**Recommended:** Supabase Migrations

**Rationale:**
- Already using Supabase
- Native migration support via Supabase CLI
- Version-controlled SQL migrations
- Rollback capabilities
- No need to introduce new ORM layer

**Alternative (if needed):**
- Continue with manual SQL files but organize into versioned migration files
- Use Supabase Dashboard SQL editor for manual migrations (not recommended for production)

**Not Recommended:**
- Prisma/Drizzle/TypeORM (would require complete refactoring of data access layer)


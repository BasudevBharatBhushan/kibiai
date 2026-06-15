# P-002: Implementation Plan - Admin Company Onboarding

## Scope
`fullstack`

## Overview
This implementation plan outlines the steps required to transition the existing Platform Admin Dashboard (`/admin`) to the new Supabase database architecture. It details the necessary backend API routes, the specific database tables involved, and how the existing React components will be refactored to align with the new application architecture document.

---

## 1. Database Operations (What DB will be created/utilized)

Based on `ai-workspace/docs/db-architecture.md` and the `application_document.txt`, the core tables are already defined, but the onboarding flow must interact with them safely.

**Tables Involved in Onboarding:**
1. **`companies`**:
   - Fields: `company_id`, `company_name`, `company_logo`, `company_address`, `license_key`, `plan_code`, `status`.
   - Action: An `INSERT` query when a new tenant is onboarded.
2. **`roles`**:
   - Fields: `role_id`, `company_id`, `role_name`, `is_super_admin`.
   - Action: Ensure an "Admin" or "Superadmin" role exists for the new company where `is_super_admin = true`.
3. **`users`**:
   - Fields: `user_id`, `auth_user_id` (Supabase Auth reference), `company_id`, `user_email`, `full_name`, `designation`, `user_status`.
   - Action: `INSERT` two default superadmin users automatically upon company creation:
     - The **Client Superadmin** (provided by the user).
     - The **KiBiAI Internal Superadmin** (for platform maintenance access).
4. **`licenses`**:
   - Fields: `license_id`, `company_id`, `plan_name`, `price`, limits, `is_active`, `expiry_date`.
   - Action: `INSERT` or `UPDATE` license details when configured in the Admin UI.
5. **`payment_logs` & `promocodes`**:
   - Action: Log payment requests/responses to Supabase instead of the legacy FileMaker layout (`KiBIAI_Admin -> PaymentLog`). Maintain active discount codes in `promocodes`.
6. **`plans`**:
   - Action: Read the static plans from Supabase rather than hitting the legacy API (`KiBIAI_Admin -> Plans`).

*Note: The `db-architecture.md` has been updated to include these new schema tables for billing, licensing, and transaction logging, replacing the legacy FileMaker implementations.*

---

## 2. Reusing Existing Admin Pages

The current `/admin` page already has a functional layout with multiple UI components (`CompanyList`, `CompanyDetails`, `LicenseInfo`, `PaymentSection`). Instead of rewriting from scratch, we will reuse them by refactoring their data models.

### Step 2.1: Update TypeScript Interfaces
In `src/app/admin/page.tsx` and its child components, update the `Company` and `License` interfaces to match the Supabase PostgreSQL structure.

**Old:**
```typescript
interface Company {
  recordId: string;
  CompanyID: string;
  CompanyAuthID: string;
  CompanyPassword: string;
  LicenseID: string;
  CompanyName?: string;
}
```

**New:**
```typescript
interface Company {
  company_id: string;
  company_name: string;
  company_logo?: string;
  company_address?: string;
  license_key: string;
  plan_code: string;
  status: string;
  created_on: string;
}
```
*Note: The license details will be derived primarily from `plan_code` referencing `PLAN_DEFAULTS`, or stored in a JSON column if custom fields are required.*

### Step 2.2: Implement New API Routes
The existing `/api/company` and `/api/license` routes are currently stubbed or pointing to an obsolete database.

We will create/update the following backend Server Actions or Next.js API Routes (`/app/api/admin/company/route.ts`):
- `GET /api/admin/companies`: Fetches all companies from the `companies` table. (Requires KiBiAI Superadmin authentication).
- `POST /api/admin/companies`: 
  1. Inserts into the `companies` table.
  2. Creates Supabase Auth users via Supabase Admin API (`auth.admin.createUser`).
  3. Inserts references into the `users` table for both the client admin and the internal admin.
  4. Inserts a superadmin role in the `roles` table.

### Step 2.3: Wire the Frontend to the New APIs
- Update `fetchCompanies`, `createCompany`, and `updateCompany` functions in `src/app/admin/page.tsx` to call our new endpoints.
- Map the state objects to the new Supabase property names.
- Update the child components (`CompanyList`, `CompanyDetails`, etc.) to consume `company.company_name` instead of `company.CompanyName`.

### Step 2.4: Admin Authentication
Replace the static `priya@kibizsystems.com` hardcoded login block with real Supabase Authentication using `supabase.auth.signInWithPassword`. 
- Only users with an internal KiBiAI Superadmin designation can access this `/admin` page. 
- Implement a middleware or layout guard to ensure standard tenant users are redirected to their `/company_name` workspaces.

---

## 3. Step-by-Step Execution Sequence

1. **Step 1: DB Readiness Verification**
   - Verify that Supabase `companies`, `users`, and `roles` tables exist and align with the documentation.
2. **Step 2: Admin Authentication Flow**
   - Refactor the `/admin` login screen to authenticate against Supabase Auth.
3. **Step 3: API Route Implementation**
   - Build the backend API for Company Onboarding (creating company + 2 superadmin users).
4. **Step 4: Frontend Data Refactoring**
   - Update `Company` interfaces across `/admin` UI components.
5. **Step 5: Integration & Verification**
   - Connect the UI components to the new APIs and verify end-to-end company creation flow.

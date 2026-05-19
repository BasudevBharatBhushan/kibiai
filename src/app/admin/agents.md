# MODULE: ADMIN & TENANT MANAGEMENT

## Overview
This module handles high-level platform administration, including tenant onboarding (company creation), license management, and role-based access control for company superadmins.

## Core Architecture
- **Entry Point**: `src/app/admin/page.tsx`
- **API Surface**: `src/app/api/company/route.ts`
- **Key Components**:
  - `CompanyList.tsx`: Handles company creation form and search.
  - `CompanyDetails.tsx`: Displays company info, active superadmins, and license status.

## Business Logic: Onboarding Flow
1. **Account Detection**: Checks if the provided email already exists in `auth_accounts`. If it exists (e.g., a Platform Admin), it reuses the account; otherwise, it creates a new one.
2. **Company Creation**: Provisions a new record in the `companies` table.
3. **Role Seeding**: Automatically creates three default roles for every new company:
   - `Superadmin` (is_super_admin: true)
   - `Admin`
   - `Staff`
4. **User Linking**: Links the auth account to the new company and assigns the `Superadmin` role to the first user.

## Security & Auth
- **Access Control**: All routes and UI elements are guarded by a `platform_admin` account type check.
- **Identity**: Uses a custom JWT session mechanism defined in `src/utils/auth.ts`.
- **Database**: Direct communication with Supabase via an Admin client to bypass RLS during system-level operations.

## Database Relationships
- `auth_accounts` (1) <-> (M) `users`
- `companies` (1) <-> (M) `users`
- `companies` (1) <-> (M) `roles`
- `roles` (1) <-> (M) `users`

## Common Tasks
- **Adding a Superadmin**: Create a new record in `users` linked to the same `company_id` and the `role_id` of the "Superadmin" role.
- **License Validation**: The system uses any Superadmin's email/password associated with the company to verify its subscription plan.

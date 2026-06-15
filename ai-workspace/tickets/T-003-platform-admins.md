# T-003: Platform Admin Architecture

## Status
COMPLETED

## Scope
`fullstack`

## Description
Separate internal KiBiAI Platform Admins from standard Company Users by creating a dedicated `platform_admins` table. This ensures internal admins are not forcefully tied to specific tenant IDs and establishes global permissions for the `/admin` dashboard.

## Requirements
1. Create `platform_admins` table linked to Supabase `auth.users`.
2. Modify `/admin` login in `page.tsx` to verify the authenticated user exists in `platform_admins`.
3. Refactor `/api/company/route.ts` to stop linking internal admins to the `users` table of newly created companies.
4. Update `db-architecture.md` documentation.

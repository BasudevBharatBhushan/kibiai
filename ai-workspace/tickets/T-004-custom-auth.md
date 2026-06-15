# T-004: Custom JWT Auth Architecture

## Status
IN_PROGRESS

## Scope
`fullstack`

## Description
Replace Supabase Auth with a custom JWT-based authentication system. Store user credentials in a unified `auth_accounts` table to enforce email uniqueness across all user types (Platform Admins and Company Users).

## Requirements
1. Create `auth_accounts` table with `email`, `password_hash`, and `account_type`.
2. Refactor `platform_admins` and `users` to link to `auth_accounts`.
3. Implement `bcryptjs` for password hashing and `jose` for JWT management.
4. Create login/logout API routes.
5. Update `/admin` and `/api/company` to use the new custom auth system.
6. Implement a JWT verification middleware/utility.

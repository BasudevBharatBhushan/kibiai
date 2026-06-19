# L-003: Platform Admin Architecture

## Summary
Decoupled internal platform admins from the tenant-specific `users` table to improve security and architectural clarity.

## Changes
### Database
- Created `platform_admins` table.
- Added RLS policy to restrict visibility to admins themselves.
- Updated `db-architecture.md`.

### Backend
- Modified `GET /api/company` to verify the requester's identity in the `platform_admins` table.
- Removed auto-linking of internal admins to new companies in `POST /api/company`.

### Frontend
- Updated `/admin/page.tsx` login flow to verify platform admin status after successful auth.
- If a user is not in `platform_admins`, they are signed out automatically with an "Access Denied" message.

## Verification Results
- [x] SQL migration applied.
- [x] Backend route correctly enforces admin check.
- [x] Frontend login blocks non-admin users.
- [x] Lint and build checks passed.

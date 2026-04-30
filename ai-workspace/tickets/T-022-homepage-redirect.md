# Ticket: T-022-homepage-redirect

## Description
Update the root landing page (`/`) to automatically redirect to the primary tenant workspace (`/kibiz-systems-inc/templates`). This removes the legacy "Go to Reports" button and ensures users land on the active workspace.

## Scope
- **Frontend**: Modify `src/app/page.tsx` to perform a redirect.

## Tasks
- [x] Create implementation plan.
- [x] Implement redirect in `src/app/page.tsx`.
- [x] Verify redirect on `localhost:3000`.
- [x] Update `agents.md` if necessary.

## Status
- **Status**: `COMPLETED`
- **Assigned to**: Antigravity
- **Created**: 2026-04-30

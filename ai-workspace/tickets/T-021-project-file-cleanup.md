# Ticket: T-021-project-file-cleanup

## Description
Perform a comprehensive cleanup of the project by removing legacy routes, redundant components, temporary debug files, and unused assets that no longer align with the multi-tenant architecture described in the `application_document.txt`.

## Scope
- **Root Level**: Delete temporary debug files (`test.html`, `test.txt`, etc.) and legacy design folders.
- **Frontend (Legacy Routes)**: Remove old top-level routes (`/reports`, `/chatbot`, `/reportConfig`, `/kibiai`) that have been superseded by the `[company_slug]` workspace.
- **Frontend (Redundant Components)**: Remove unused or duplicate components (e.g., `src/components/li.tsx`, `src/components/DynamicReport.tsx`).
- **Assets**: Cleanup legacy design files in `html_designs/`.

## Tasks
- [x] Create implementation plan.
- [x] Identify and verify all files for deletion.
- [x] Move relevant documentation (like `postman.json`) to a proper location.
- [x] Delete legacy routes in `src/app`.
- [x] Delete redundant components in `src/components`.
- [x] Delete temporary files in root.
- [x] Run `npm run build` to ensure no broken references.
- [x] Update `agents.md` files if necessary.

## Status
- **Status**: `COMPLETED`
- **Assigned to**: Antigravity
- **Created**: 2026-04-30

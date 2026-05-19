# Implementation Plan: P-021-project-file-cleanup

## 1. Objective
Systematically remove legacy and temporary files from the KiBiAI project to ensure the codebase reflects the current multi-tenant architecture and is free of clutter.

## 2. Proposed Deletions

### 2.1 Root Level Files (Temporary/Debug)
- `test.html`: Large legacy HTML output.
- `test.txt`: Legacy log/data.
- `test2.html`: Legacy HTML output.
- `test2.txt`: Legacy log/data.
- `CLAUDE.md`: Redundant instruction file.

### 2.2 Legacy Routes (`src/app`)
- `src/app/chatbot/`: Superseded by embedded chatbot in Builder.
- `src/app/reportConfig/`: Legacy configuration route.
- `src/app/reports/`: Legacy report viewing route (replaced by `[company_slug]/reports`).
- `src/app/kibiai/`: Experimental/Old route.

### 2.4 Redundant Components (`src/components`)
- `src/components/li.tsx`: Duplicate of `LicenseInfo.tsx`.
- `src/components/DynamicReport.tsx`: Legacy report component (superseded by `DynamicReportPreview.tsx`).

## 3. Relocations
- `postman.json`: Move to `ai-workspace/docs/misc/postman.json`.

## 4. Verification Plan
1. **Lint Check**: `npm run lint` to ensure no broken imports remain.
2. **Build Check**: `npm run build` to verify the application still compiles correctly.
3. **Manual Verification**: Briefly check `src/app/admin` and `src/app/[company_slug]` to ensure they still function as expected.

## 5. Rollback Strategy
All files being deleted are either:
- Not tracked by git (ignored).
- Legacy files that can be recovered from git history if accidentally deleted.

## 6. Approval Gate
- [ ] Platform Admin dashboard still accessible.
- [ ] Tenant workspace branding still loading.
- [ ] Report generation flow intact.

# L-011 — Execution Log: Template Creation & Setup Wizard
**Ticket**: T-011 | **Date**: 2026-04-27 | **Status**: COMPLETED

---

## Subtask Execution Summary

| # | Subtask | Status | Notes |
|---|---|---|---|
| 1 | SQL Verification | ✅ COMPLETE | `report_templates` and `modules` tables verified via Supabase MCP — all columns exist, RLS enabled, no migration needed |
| 2 | API: POST /api/company/templates | ✅ COMPLETE | Create Draft template, lookups user_id via account_id from users table |
| 3 | API: GET /api/company/modules | ✅ COMPLETE | Added GET handler to existing modules route |
| 4 | API: FileMaker Proxy Routes | ✅ COMPLETE | `/api/filemaker/setup/layouts` handles both data-api (layouts list) and o-data-api ($metadata); `/api/filemaker/setup/fields` fetches layout fieldMetaData |
| 5 | API: PUT /api/company/templates/[id]/setup | ✅ COMPLETE | Validates JSON structure, ownership check, saves to Supabase |
| 6 | Frontend: CreateTemplateModal + Templates page | ✅ COMPLETE | Auto-focus, keyboard handlers, module dropdown, loading states |
| 7 | Frontend: Setup Wizard (all components) | ✅ COMPLETE | Full wizard with all 7 sub-components |
| 8 | Documentation | ✅ COMPLETE | This log |

---

## Files Created

### Backend APIs
- `src/app/api/company/templates/route.ts` — POST (create) + GET (list)
- `src/app/api/company/modules/route.ts` — GET handler added
- `src/app/api/filemaker/setup/layouts/route.ts` — layouts + OData metadata proxy
- `src/app/api/filemaker/setup/fields/route.ts` — field metadata proxy
- `src/app/api/company/templates/[template_id]/setup/route.ts` — GET + PUT

### Frontend
- `src/components/templates/CreateTemplateModal.tsx`
- `src/app/[company_slug]/templates/page.tsx` (updated)
- `src/app/[company_slug]/templates/[template_id]/setup/page.tsx`
- `src/components/setup/SetupWizard.tsx`
- `src/components/setup/HostConfigSection.tsx`
- `src/components/setup/AddDatabaseSection.tsx`
- `src/components/setup/TableCard.tsx`
- `src/components/setup/RelationshipsPanel.tsx`
- `src/components/setup/SetupJsonPreview.tsx`
- `src/components/setup/ODataFieldModal.tsx`

---

## Build Result
```
Exit code: 0
✓ Compiled successfully
✓ All 38 static pages generated
/[company_slug]/templates/[template_id]/setup — registered as Dynamic route
```

---

## Key Technical Decisions Made During Execution
1. **`session.userId` fix** — `UserPayload` only has `accountId`, not `userId`. Fixed by looking up `users.user_id` from `account_id` before template insert.
2. **OData fully enabled** — Both `data-api` and `o-data-api` protocols are active in all components. The `HostConfigSection` protocol select has both options enabled.
3. **OData layout row toggle** — On `o-data-api`, layout select row is hidden (OData has no layouts). On switch back to `data-api`, layout row reappears.
4. **ODataFieldModal** — Triggered when a table is selected under `o-data-api`. User picks fields from a searchable checkbox list before the table is added to state.
5. **useReducer for setup JSON** — Centralized state management ensuring all components operate on the same config object.
6. **Credentials never hit client bundle** — All FileMaker API calls are server-side proxies.

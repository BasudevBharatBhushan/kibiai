# Plan: P-046 Bypass Company Check for Platform Admin

- **Plan ID**: P-046
- **Associated Ticket**: T-046
- **Status**: DONE

## Proposed Changes

### 1. `/api/templates/[template_id]/config/route.ts`
- `GET`: Remove hard `.eq("company_id", session.companyId)` — apply only if not platform_admin.
- `POST` (verify ownership): Remove hard `.eq("company_id", session.companyId)` — apply only if not platform_admin.
- `POST` (update): Remove hard `.eq("company_id", session.companyId)` — apply only if not platform_admin.

### 2. `/api/templates/[template_id]/generate/route.ts`
- Fix auth guard: allow platform_admin even without session.companyId.
- Template fetch: apply company_id filter only if not platform_admin.
- Resolve `targetCompanyId` from the fetched template for all subsequent DB writes.

### 3. `/api/templates/[template_id]/generate/stream/route.ts`
- Fix auth guard: allow platform_admin even without session.companyId.
- Template fetch: apply company_id filter only if not platform_admin.
- Resolve `targetCompanyId` from the fetched template for all subsequent DB writes.

### 4. `/api/report-templates/[template_id]/charts/route.ts`
- `GET`: Fix auth guard + hard company_id filter.
- `POST`: Fix auth guard + hard company_id filter. Resolve `targetCompanyId` from template for chart insert.
- `DELETE`: Fix auth guard + hard company_id filter.

### 5. `/api/report-templates/[template_id]/pivot/route.ts`
- `GET`: Fix auth guard (`!session?.companyId` → allow platform_admin) + hard company_id filter.
- `PATCH`: Fix auth guard + hard company_id filters (two occurrences).

### 6. `/api/report-templates/[template_id]/chart-thread/route.ts`
- `PATCH`: Fix auth guard + hard company_id filter.

### 7. `/api/report-templates/[template_id]/insight-thread/route.ts`
- `PATCH`: Fix auth guard + hard company_id filter.

## Pattern Applied Consistently
```typescript
// Auth guard — allow platform_admin even without companyId in session
if (!session || (session.accountType !== 'platform_admin' && !session.companyId)) {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
}

// DB query — scope to company only for regular users
let query = supabase.from("report_templates").select(...).eq("report_template_id", template_id);
if (session.accountType !== 'platform_admin') {
  query = query.eq("company_id", session.companyId);
}

// Resolve target company from fetched template (for writes)
const targetCompanyId = template.company_id;
```

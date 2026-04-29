# P-018 — Implementation Plan: Report Generation Flow Fix

**Ticket:** T-018  
**Scope:** fullstack  

---

## Phase 1 — Backend: Fix `generate` API route

**File:** `src/app/api/templates/[template_id]/generate/route.ts`

### Changes:
1. **Remove** the `supabase.from("report_templates").update({ report_template_data_json: ... })` block entirely (lines 113–135).
2. **Always** run the `reports` insert (remove the `if (save_to_history)` guard).
3. **Extract report name** from `report_structure_json`:
   ```ts
   const titleHeaderItem = Array.isArray(reportStructureJson)
     ? reportStructureJson.find((i: any) => 'TitleHeader' in i)
     : null;
   const reportHeading = titleHeaderItem?.TitleHeader?.MainHeading
     ?? report_name
     ?? template.report_template_name
     ?? "Report";
   ```
4. Use `reportHeading` as `report_name` in the insert.
5. Remove `save_to_history` from the Zod schema (no longer needed from client).
6. Always return `report_id` in the response.

---

## Phase 2 — Frontend: Generate Page Overhaul

**File:** `src/app/[company_slug]/templates/[template_id]/generate/page.tsx`

### Changes:

#### 2a. Remove "Save" button & state
- Remove `isSaving`, `setIsSaving` state
- Remove `save_to_history` from the `handleGenerate` call payload
- Remove the save bar's "Save to History" button JSX

#### 2b. After generation: show "View Charts" button
- In the bottom save bar (now just a status bar), replace "Save to History" with a **"View Charts"** button
- The button is only shown if the template has `chartSchemas.length > 0`
- Clicking it sets `chartsModalOpen = true`

#### 2c. Remove inline chart panel
- Remove `chartsOpen` state and the `{chartsOpen && <div>...</div>}` inline chart panel from below the report
- Remove the `DashboardProvider` wrapper at the route level

#### 2d. Chart Modal component (inline in the page file)
```tsx
function ChartModal({ open, onClose, schemas, rows, templateId }: {
  open: boolean;
  onClose: () => void;
  schemas: ReportChartSchema[];
  rows: any[];
  templateId: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between bg-white border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-purple-600" />
          <span className="font-bold text-slate-800">Charts</span>
          <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold">Live Report Data</span>
        </div>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-hidden">
        <DashboardProvider
          initialSchemas={schemas}
          initialDataset={rows}
          initialLayoutMode="grid"
          templateId={templateId}
          isViewerMode={true}
        >
          <DashboardGrid />
        </DashboardProvider>
      </div>
    </div>
  );
}
```

#### 2e. Row extraction utility
Use `extractBodyRows` (from `@/lib/charts/supabaseAdapters`) on the fresh `report_structure_json` to get the flat row array for `DashboardProvider`.

#### 2f. Chart schemas fetch
On the first generate, fetch schemas via `GET /api/report-templates/[template_id]/charts` and store in `chartSchemas` state. Pass `schemas` and extracted `rows` to the `ChartModal`.

---

## Phase 3 — Type Import

- Import `ReportChartSchema` from `@/lib/charts/ChartTypes` in the generate page
- Import `extractBodyRows` from `@/lib/charts/supabaseAdapters`
- Import `X` from `lucide-react`

---

## Sequence Diagram

```
User clicks Generate
  → POST /api/templates/[id]/generate
      → engine generates report_structure_json
      → INSERT INTO reports (auto-save, always)
      → returns { report_structure_json, report_id }
  → Frontend stores reportData + reportId
  → Status bar shows: "Report saved · [heading]" + "View Charts" button
  → User clicks "View Charts"
      → GET /api/report-templates/[id]/charts (schemas)
      → extractBodyRows(reportData) → rows[]
      → ChartModal opens with DashboardProvider(schemas, rows)
      → DashboardGrid renders real charts with live data
```

---

## Files Modified

| File | Change |
|---|---|
| `src/app/api/templates/[template_id]/generate/route.ts` | Remove template update, always save report |
| `src/app/[company_slug]/templates/[template_id]/generate/page.tsx` | Remove save button, add chart modal |

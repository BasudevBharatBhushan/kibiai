# P-046: Classic View Modifications Implementation Plan

## Components to Modify

1. **`src/components/report-builder/ClassicViewSettingsSection.tsx`**
   - Update `ClassicViewSettings` interface to include:
     - `paginate: boolean`
     - `dateBreakdown?: { field: string; interval: "Month" | "Quarter" }`
   - Add a prop `dateFields?: string[]`
   - Render UI for the Pagination toggle (default false).
   - Render UI for Date Breakdown (dropdown to select field and interval).

2. **`src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`**
   - Compute `dateFields` from `bodyData`.
   - Update `classicSettings` state initialization to include `paginate: false`.
   - Pass `dateFields` to `<ReportConfigurator>`.

3. **`src/components/ReportConfigurator.tsx`**
   - Accept `dateFields` prop and pass it to `<ClassicViewSettingsSection>`.

4. **`src/components/report-viewer/ClassicReportView.tsx`**
   - **Pagination**: 
     - Add `currentPage` and `pageSize = 50` state.
     - Slice the `rows` array before mapping if `settings.paginate` is true.
     - Add pagination controls (Previous/Next) at the bottom.
   - **Date Breakdown**:
     - Before calling `buildRows`, if `dateBreakdown` is set, iterate over `filteredBodyData` and inject a formatted `_date_breakdown` field (e.g., "YYYY-MM" or "Q1 YYYY").
     - Prepend a temporary subsummary to the `subsummaries` array to group by this new field.
   - **Print Option**:
     - Add a "Print Classic View" button in the header (`.cv-report-header`).
     - Create a `handlePrint` function that clones the table, injects `classicview.css` styles into a new window, and calls `window.print()`.

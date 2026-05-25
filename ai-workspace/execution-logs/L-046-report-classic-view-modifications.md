# L-046: Classic View Modifications Execution Log

## Step 1: Update ClassicViewSettingsSection
- **File**: `src/components/report-builder/ClassicViewSettingsSection.tsx`
- **Changes**: 
  - Added `paginate` and `dateBreakdown` to `ClassicViewSettings` interface.
  - Added `dateFields` prop.
  - Implemented UI for Paginate Classic View toggle.
  - Implemented UI for Date Breakdown dropdowns (Field and Interval).

## Step 2: Update Configurator Page Content
- **File**: `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`
- **Changes**:
  - Computed `dateFields` using `useMemo` by detecting parsable date values in `bodyData[0]`.
  - Initialized `paginate: false` in `classicSettings` state.
  - Passed `dateFields` down to `ReportConfigurator`.

## Step 3: Update ReportConfigurator
- **File**: `src/components/ReportConfigurator.tsx`
- **Changes**:
  - Added `dateFields` to props.
  - Passed `dateFields` to `ClassicViewSettingsSection`.

## Step 4: Update ReportPreview
- **File**: `src/components/ReportPreview.tsx`
- **Changes**:
  - Updated `effectiveSettings` default to include `paginate: false`.
  - Passed `paginate` and `dateBreakdown` down to `ClassicReportView`.

## Step 5: Update ClassicReportView
- **File**: `src/components/report-viewer/ClassicReportView.tsx`
- **Changes**:
  - Added dynamic subsummary injection for `_date_breakdown` when `dateBreakdown` is active.
  - Mapped over `filteredBodyData` to calculate the interval value (Month or Quarter) and set `_date_breakdown`.
  - Added `currentPage` and `pageSize` state for pagination.
  - Rendered `visibleRows` slice and simple pagination controls in the table footer when `paginate` is true.
  - Added `handlePrint` function that copies the table HTML and active stylesheets to a popup window and invokes `window.print()`.
  - Added a "Print" button in the `.cv-meta-row` area.

# T-046: Classic View Modifications

## Objective
Fix bugs and add requested features to the Report Configurator's Classic View.

## Requirements
1. **Pagination**: Add a toggle in the Classic View Settings to enable pagination. When enabled, paginate the classic view rows (e.g., 50 items/page). Do not paginate by default.
2. **Print Option**: Provide an option to print the Classic View, similar to how the Print View works.
3. **Date Breakdown**: Add an option in Classic View Settings to breakdown the report by Month or Quarter for detected date fields.

## Approach
- Update `ClassicViewSettings` interface to include `paginate` and `dateBreakdown` options.
- Detect date fields in `page.tsx` and pass them down.
- In `ClassicViewSettingsSection.tsx`, add toggles/dropdowns for Pagination and Date Breakdown.
- In `ClassicReportView.tsx`:
  - Implement client-side pagination when `paginate` is enabled.
  - Implement a `handlePrint` function that opens a new window, copies the table HTML and styles, and calls `window.print()`. Add a Print button in the classic view header.
  - If `dateBreakdown` is active, inject a dynamic subsummary grouping by Month or Quarter based on the selected date field.

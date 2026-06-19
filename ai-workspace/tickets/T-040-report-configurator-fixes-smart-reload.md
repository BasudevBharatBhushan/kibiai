# T-040 — Report Configurator: Sub-Summary/Grand-Summary Parsing Fix + Smart Reload

**Status:** `TODO`
**Type:** `fullstack`
**Priority:** High
**Created:** 2026-05-19

---

## Problem Statement

### Bug 1: Sub-Summary Parsing Mismatch
The `GrandSummarySection` and `SubSummarySection` configurator panels **don't correctly parse/display** fields from the current config JSON. When the config contains `summary_fields` like `"Qty_Received"`, `"Total Sold"`, `"CurrentInventory"`, `"InventoryTurnover"`, the selector shows blank because:
- `summary_fields` stores **raw field names** (e.g. `"InventoryTurnover"`)
- But `getNumberOptions()` builds options keyed by **field value** (same raw name) — the value matches, but the select dropdown can't find it because `getFieldOptions(tableName, "number")` only scans schema tables, not the config's `report_columns`-filtered subset.
- Calculated fields aren't being found because `getFieldOptions` from `useSchema` doesn't return them — only raw schema fields.

### Bug 2: Grand Summary Parsing Mismatch
Same root cause — `summary_fields` in config holds raw field identifiers, but `getNumberOptions()` in `GrandSummarySection` doesn't properly resolve calc fields unless they appear in `custom_calculated_fields` with matching `field_name`.

### Feature: Smart Reload (Soft vs Hard)
Currently, every "Update" button click triggers a **full API round-trip** (save config → stream generate-report → return new preview). This is wasteful for changes that don't require re-fetching raw data:

**Soft Reload** (pure client-side re-render):
- Changes to `report_header` / `response_to_user`  
- Reordering body columns, sort order, subsummary groups
- Adding/removing `summary_fields` (grand summary fields)
- Adding/removing `group_total` fields
- Adding/changing custom calc `label` only

**Hard Reload** (full API + data fetch required):
- Changes to `db_defination` (table relationships, fetch order)
- Changes to `date_range_fields` or `filters`
- Adding/removing `report_columns` (body fields)
- Adding/removing `group_by_fields` key or changing group `table`/`field`
- Adding/modifying `custom_calculated_fields` formula or dependencies
- User explicitly clicks "Force Refresh" button

---

## Acceptance Criteria

- [ ] Sub-Summary group total fields display correctly for calc fields
- [ ] Grand Summary fields display the correct selected value (calc + schema fields)
- [ ] "Update Report" button performs soft reload when possible (no API call for data)
- [ ] "Update Report" button performs hard reload (full stream) when schema/data changes are detected
- [ ] A subtle "Force Refresh" icon button is visible in the configurator header for explicit hard reload
- [ ] Soft reload instantly re-renders the preview from existing raw data without loading overlay

---

## Files In Scope

- `src/components/ReportConfigurator.tsx`
- `src/components/report-builder/GrandSummarySection.tsx`
- `src/components/report-builder/SubSummarySection.tsx`
- `src/context/ReportContext.tsx`
- `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx`
- `src/lib/utils/utility.ts` (`generateReportStructure`)

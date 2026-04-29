# Execution Log: L-020-template-list-ui-overhaul

## Date: 2026-04-30
## Ticket: T-020
## Status: COMPLETED

## Changes Made:

### page.tsx — Complete rewrite of split layout
- Container: `height: 680px` (was `minHeight: 520px`) — fixed height required for independent scroll
- `overflow-hidden` removed from container (was clipping child scroll)
- Header row extracted into its own non-scrolling `<div>` with `table-fixed` table
- Body rows in a separate `<div className="flex-1 overflow-y-auto">` — truly scrolls independently
- `table-fixed` used on both tables to ensure column widths stay aligned
- Preview panel: `w-[480px]` (was 420px), `h-full overflow-hidden` — TemplatePreviewPanel's `h-full` now resolves correctly
- Serial # column: first `<th>` and `<td>` in every row

### DynamicReportPreview.tsx

#### Print blank page fix (handleExportPDF)
- OLD: `[style*="display: none"]` selector missed `display:none` (no space) variants
- NEW: iterate all `[style]` elements, call `style.removeProperty('display')` — covers all cases
- Also `removeProperty('display')` on all `<table>` and `<tr>` elements
- Remove `data-page` attributes from clone — browser CSS handles pagination natively in print

#### previewMode viewport
- When `previewMode=true`: renders report in a `w-full bg-white` div, content flows naturally
  at panel width — no A4 paper (210mm) constraints, no horizontal overflow, readable text
- When `previewMode=false`: unchanged A4 paper rendering

## TypeScript:
- Zero errors in our source files
- Pre-existing test errors in `tests/api/filemaker_setup.test.ts` are unrelated


## Date: 2026-04-30
## Ticket: T-020
## Status: COMPLETED

## Changes Made:

### 1. src/app/[company_slug]/templates/page.tsx
- Added `#` column as first `<th>` in template list `<thead>`
- Updated `colSpan` from 5 → 6 for empty-state cell
- Changed `.map((template) =>` to `.map((template, index) =>` to track row index
- Added `<td>{index + 1}</td>` as first cell in each row

### 2. src/components/DynamicReportPreview.tsx
- Added `previewMode?: boolean` to `DynamicReportProps` interface
- Updated component signature: `({ jsonData, previewMode = false })`
- Toolbar (both portal and fallback) now only renders when `!previewMode`
- **Pagination fix**: `current-date` height is now added to `currentHeight`
  (previously only `title-header` was counted → page count was too high by ~1)
- **Print fix**: Removed outer `<div class="dynamic-report">` wrapper in
  `handleExportPDF`. `clone.innerHTML` already contains `.dynamic-report`,
  so double-wrapping caused a blank first page in PDF output.

### 3. src/components/templates/TemplatePreviewPanel.tsx
- Extracted shared `<SkeletonBlock>` component used in multiple states
- **Preloading behaviour**: On template switch, `previewData` is NOT cleared
  before the new fetch → old preview stays rendered. A translucent skeleton
  overlay renders on top while the new data loads.
- **No-data state**: Now shows static (non-animated) skeleton layout at 40%
  opacity plus a "No preview available" message below it — panel is never bare.
- First load (no prior data): full animated skeleton as before.

## TypeScript:
- `npx tsc --noEmit` passes with zero errors in our source files.
  Only pre-existing error in auto-generated `.next/dev/types/routes.d.ts`.

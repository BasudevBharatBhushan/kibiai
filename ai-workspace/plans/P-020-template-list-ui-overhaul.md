# Plan: P-020-template-list-ui-overhaul

## Files Modified:
- `src/components/DynamicReportPreview.tsx`
- `src/components/templates/TemplatePreviewPanel.tsx`
- `src/app/[company_slug]/templates/page.tsx`

## Step-by-Step:

### Step 1 — Serial Number Column (page.tsx)
- Add `#` `<th>` as first column in `<thead>`
- Add `<td>` with `{index + 1}` as first cell in each row

### Step 2 — previewMode prop (DynamicReportPreview.tsx)
- Add `previewMode?: boolean` to `DynamicReportProps`
- When `previewMode === true`, skip rendering the toolbar (both portal and fallback)
- Toolbar is only shown in full report view

### Step 3 — Fix page number mismatch (DynamicReportPreview.tsx)
- Root cause: `current-date` height is NOT added to `currentHeight` in `runPagination`
  - `title-header` height IS counted: `currentHeight += offsetHeight`
  - `current-date` is tagged `data-page='1'` but its height is skipped
- Fix: After tagging headers, also accumulate `current-date` height into `currentHeight`

### Step 4 — Fix blank first page in print (DynamicReportPreview.tsx)
- Root cause: `containerRef.current.innerHTML` already contains `<div class="dynamic-report">...</div>`
  - Print template wraps it again in `<div class="dynamic-report">` → double nesting
  - Browser sees the outer div as empty "page 1", content starts on page 2
- Fix: In `handleExportPDF`, extract the inner `.dynamic-report` element's innerHTML
  instead of `clone.innerHTML`, to avoid double wrapping.

### Step 5 — Preloading behaviour (TemplatePreviewPanel.tsx)
- Currently: skeleton shows during load, then either data or "no data" state
- New: show skeleton AND the report preview simultaneously when data exists but a
  new template is selected (i.e. show skeleton while loading, and when data arrives show the report)
- Implementation: when `isLoading === true` AND `previewData` exists from a previous
  selection, show the report (dimmed) while the new one loads. When no prior data exists
  during load, show the full skeleton.

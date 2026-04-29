# Ticket: T-020-template-list-ui-overhaul

## Status: COMPLETED
## Type: frontend
## Priority: High

## Tasks:
1. [x] Wider preview panel + independent scrolling
2. [x] Remove pill row; view context inline in SubHeader
3. [x] Serial number (#) column — added as first column in template list table
4. [x] Add previewMode prop to DynamicReportPreview — toolbar hidden when previewMode=true
5. [x] Preloading: skeleton shown while loading; old data visible behind overlay when switching
6. [x] Fix current-date height not counted (page number mismatch) — both title-header and current-date heights now counted
7. [x] Fix double dynamic-report wrapping in print (blank first page) — removed redundant wrapper div

## Constraints Met:
- Existing report previewer design was NOT changed
- Preview and print use identical content (no double wrapping)

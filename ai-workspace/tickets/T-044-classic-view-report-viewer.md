# T-044 — Classic View for Report Template Viewer

## Status: IN PROGRESS (v2 iteration)
## Scope: frontend
## Type: feature

## Summary
Implement a "Classic View" (interactive, collapsible table-based layout) as the **default** view in the Report Configurator's report preview panel. The existing print-layout view becomes "Print View". Add two Classic-specific settings to the right-side ReportConfigurator panel:
1. **Collapse Body** — subsummary rows only; detail body rows hidden on collapse.
2. **Show Average in Subtotals** — toggles sum vs. average display in group total rows, with `avg` label on next line.

## Iteration v2 Additions (T-044b)
- **Sticky column headers** — thead fixed at top during scroll.
- **Avg on next line** — small "avg" text below the numeric value instead of inline.
- **Subsummary alignment** — label cell is always left-aligned; text uses `overflow: visible` to flow across adjacent empty cells (no colspan needed).
- **Quick Filters** — per-subsummary-field dropdown filters that operate on JSON data client-side (no refetch). Reset button when active.
- **Drill-down modal** — clicking a **collapsed** group row opens a modal with all detail records for that group. Clicking an **expanded** group row collapses it.
- **Responsive layout** — table cells wrap text (`word-break: break-word`). No forced horizontal overflow for label cells. Numeric cells stay `white-space: nowrap`.
- **Background print pagination** — DynamicReport (Print view) is always kept mounted in an absolutely-positioned, off-screen container (`left: -9999px; visibility: hidden`). Pagination calculation runs once on first load; switching to Print view is instant.
- **View toggle moved to configurator header** — Classic | Print toggle now lives in the ReportConfigurator header row. The old floating bar in ReportPreview is removed.
- **Classic settings at top of configurator** — ClassicViewSettingsSection renders at the very top of the configurator's scrollable content (before HeaderSection) when in Classic view mode.
- **Report header in classic view** — MainHeading, SubHeading, date range chips, filter chips, and record count are shown at the top of the classic view (styled to match the classic aesthetic).

## Architecture

### State lift
- `viewMode: "classic" | "print"` — lives in `ConfiguratorPageContent` (page.tsx)
- `classicSettings: { showAvg, collapseBody }` — lives in `ConfiguratorPageContent`
- Both are passed as props to `ReportConfigurator` and `ReportPreview`

### Key files
| File | Role |
|---|---|
| `src/components/report-viewer/ClassicReportView.tsx` | Main classic view renderer |
| `src/components/report-builder/ClassicViewSettingsSection.tsx` | Settings toggles |
| `src/styles/classicview.css` | All Classic view styles |
| `src/components/ReportPreview.tsx` | View switcher; keeps DynamicReport always mounted |
| `src/components/ReportConfigurator.tsx` | View toggle in header; shows ClassicViewSettings at top |
| `src/app/[company_slug]/templates/[template_id]/configurator/page.tsx` | State owner |

## Reference
- HTML design prototype: `html_designs/reporthtml.html`
- Current print view renderer: `src/components/DynamicReportPreview.tsx`
- Preview entry point: `src/components/ReportPreview.tsx`
- Config panel: `src/components/ReportConfigurator.tsx`
- Report state: `src/context/ReportContext.tsx`

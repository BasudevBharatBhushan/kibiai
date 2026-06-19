# T-033 — Chart Comparison Feature

## Status: COMPLETED

## Scope: fullstack

## Created: 2026-05-12

## Summary
Implement a per-chart comparison feature in both the **Chart Viewer (User Mode)** and the **Chart Analyzer (Admin Mode)**. Each individual `ChartCard` will have a "Compare" button. Clicking it opens a split-view **Comparison Modal** that:
1. Displays the original chart on the **left** panel (with its report metadata/filters or template metadata in Admin mode).
2. Lets the user pick a **comparison data source** on the **right** panel — either:
   - A previously saved report from history for the same template (list is shown), **or**
   - A fresh report generated with new filter inputs on-the-fly.
3. Renders the same chart type for the comparison source on the **right** panel.
4. Labels each panel clearly (report/template name, date range, filters used).

## Problem Statement
Users and Admins currently cannot compare how the same chart metric performs across two different reports/periods. They must open two separate browser tabs and manually compare values. This is error-prone and breaks analytical flow.

## Acceptance Criteria
- [ ] Every `ChartCard` renders a "Compare" icon button (top-right next to drag handle / type selector).
- [ ] Clicking "Compare" opens a full-screen modal with a **Left Panel** (original chart) and **Right Panel** (comparison chart).
- [ ] In **User Mode**: Left panel shows the selected report's data vs the Right panel's selected/generated report.
- [ ] In **Admin Mode**: Left panel shows the report template's preview data vs the Right panel's selected/generated report from the same template.
- [ ] Right panel shows a list of report history items for the same template. Selecting one immediately renders the comparison chart.
- [ ] A "New Filter" option in the right panel allows generating a new report and then rendering the chart.
- [ ] Each panel displays the report/template name, date range, and applied filters as a subtitle.
- [ ] Modal is closeable via ESC or a close button.
- [ ] Fully read-only — no data mutation occurs (except creating a new report in the New Filter flow).

## Affected Files
- `src/components/chart-dashboard/ChartCard.tsx` — Add Compare button
- `src/components/chart-dashboard/CompareModal.tsx` — New modal component
- `src/components/chart-dashboard/CompareChartPanel.tsx` — New panel rendering one side of the comparison
- `src/components/chart-dashboard/ReportHistoryPicker.tsx` — New report history list
- `src/app/api/reports/route.ts` — Existing (already returns list)
- `src/app/api/reports/[report_id]/route.ts` — Existing (already returns chart data)
- `src/styles/dashboard.css` — Minor additions for compare modal styles
- `src/components/chart-dashboard/agents.md` — Update documentation

## Dependencies
- No new DB migrations required (uses existing `reports` + `chart_templates` + `charts` tables).
- Existing API `/api/reports` (GET) and `/api/reports/[report_id]` (GET) are sufficient.
- For "New Filter" flow: reuses existing `/api/generate-report` endpoint with the same template configuration.

## Related Tickets
- T-032 (chart history viewer fixes — now stable)

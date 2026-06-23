# T-050 — Chart Card: Filter Display + Layout Persistence Bug

**Status:** COMPLETED  
**Priority:** High  
**Branch:** `fix/T-050-chart-filter-display-layout-save`

---

## Issue 1: Filter Display on Chart Card

### Requested Behavior
- Chart-level filters (e.g. `"Invoice Date >= 2025-01-01"`) → remain visible as text on the card (current behavior)
- Report template date range (`report_date_range`) → collapse to a calendar icon only; full date range visible in tooltip on hover

### Current Behavior
Both the date range text (`01-01-2025 — 12-31-2025 (Invoice Date)`) AND the filter text are rendered inline in the card header. With multiple filters and a date range, the header becomes cramped and truncates.

### File Affected
`src/components/chart-dashboard/CardScopeMeta.tsx`

---

## Issue 2: Chart Layout Not Persisting Correctly

### Symptom
After dragging/resizing chart cards, the positions and sizes do not reload correctly on next page visit.

### Root Cause (confirmed — two compounding bugs)

**Bug A — Wrong breakpoint layout saved as `lg`**

`currentLayouts` in `DashboardContext.tsx` is always `{ lg: activeCharts.map(c => c.layout!) }`.
The `Responsive` grid has breakpoints: `lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0`.

At any viewport < 1200px (e.g. a laptop at 1024px), the grid operates at `md` breakpoint. The `Responsive` component auto-generates a `md` layout (stacking charts vertically, `x=0` for everything). Its `onLayoutChange` fires with this `md`-compacted layout. `updateLayout` in `DashboardContext.tsx` detects `hasChanges = true` (because the auto-compact moved positions), updates `allCharts` with these stacked positions, and `triggerAutoSave` persists them as the `lg` layout to Supabase.

Result: every time the page loads at < 1200px, the layout is progressively overwritten with a single-column stacked version.

**Bug B — Vertical compaction moves items even at `lg` breakpoint**

`compactType` is not set in `DashboardGrid.tsx`, so it defaults to `"vertical"`. This means react-grid-layout automatically moves items upward to fill vertical gaps. When a user drags a chart to a deliberate position leaving a gap above, the grid compacts it upward before `onLayoutChange` fires — so the saved position differs from where the user dropped it.

### Files Affected

| File | Change |
|------|--------|
| `src/components/chart-dashboard/DashboardGrid.tsx` | Track breakpoint, disable compaction, use drag/resize stop for saves |
| `src/context/DashboardContext.tsx` | Split `updateLayout` (state-only) from `saveLayout` (state + save) |

---

## Acceptance Criteria

- [ ] Report date range on chart card is collapsed to a calendar icon; tooltip shows the full date range
- [ ] Chart filters remain visible as text on the card  
- [ ] Dragging charts to any position at `lg` (≥ 1200px) viewport saves that exact position
- [ ] Reloading the page restores all charts to their saved positions and sizes
- [ ] No spurious layout saves fire at non-lg breakpoints
- [ ] Charts do not auto-compact when dragged (they stay where dropped)

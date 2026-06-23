# P-050 — Implementation Plan: Filter Display + Layout Save Fix

**Ticket:** T-050  
**Status:** AWAITING APPROVAL

---

## Change 1: CardScopeMeta — Collapse Date Range to Icon

**File:** `src/components/chart-dashboard/CardScopeMeta.tsx`

Replace the inline date range text span with an icon-only element. The tooltip already exists (`title={...}`) so the information isn't lost.

**Before (lines 52–68):**
```tsx
{hasDates && (
  <span
    className="inline-flex items-center gap-1 shrink-0"
    title={`Report data window: ...`}
  >
    <FiCalendar size={10} className="text-slate-400" />
    <span>
      {formatDate(dateRange!.start)} — {formatDate(dateRange!.end)}
    </span>
    {dateRange?.field && (
      <span className="text-slate-400">({dateRange.field})</span>
    )}
  </span>
)}
```

**After:**
```tsx
{hasDates && (
  <span
    className="inline-flex items-center shrink-0 cursor-default"
    title={
      dateRange?.field
        ? `Report window: ${formatDate(dateRange!.start)} → ${formatDate(dateRange!.end)} (${dateRange.field})`
        : `Report window: ${formatDate(dateRange!.start)} → ${formatDate(dateRange!.end)}`
    }
  >
    <FiCalendar size={10} className="text-slate-400" />
  </span>
)}
```

Also remove the separator dot between date range and filters (it becomes redundant when the date range collapses to just an icon — the icon alone provides enough visual separation).

---

## Change 2: DashboardContext — Split updateLayout from saveLayout

**File:** `src/context/DashboardContext.tsx`

### 2a. Add `saveLayout` to context interface (line ~63):
```typescript
saveLayout: (newLayout: Layout[]) => void;
```

### 2b. Modify `updateLayout` — state-only update, no save trigger (lines 350–379):
```typescript
const updateLayout = useCallback((newLayout: Layout[]) => {
  if (isViewerMode) return;
  setAllCharts(prevCharts => {
    const layoutMap = new Map(newLayout.map(l => [l.i, l]));
    return prevCharts.map(c => {
      const l = layoutMap.get(c.id);
      if (!l) return c;
      return { ...c, layout: { ...l, i: c.id } };
    });
  });
}, [isViewerMode]);
```
(Removes the `hasChanges` check — always apply so the grid stays in sync; removes `triggerAutoSave` call.)

### 2c. Add `saveLayout` — called only on explicit user stop (drag/resize stop):
```typescript
const saveLayout = useCallback((newLayout: Layout[]) => {
  if (isViewerMode) return;
  setAllCharts(prevCharts => {
    const layoutMap = new Map(newLayout.map(l => [l.i, l]));
    const nextCharts = prevCharts.map(c => {
      const l = layoutMap.get(c.id);
      if (!l) return c;
      return { ...c, layout: { ...l, i: c.id } };
    });
    triggerAutoSave(nextCharts, visibleChartIds, activeLayout);
    return nextCharts;
  });
}, [triggerAutoSave, visibleChartIds, activeLayout, isViewerMode]);
```

### 2d. Expose `saveLayout` in context value and DashboardContextType.

---

## Change 3: DashboardGrid — Breakpoint Guard + Compaction Off + Stop Handlers

**File:** `src/components/chart-dashboard/DashboardGrid.tsx`

### 3a. Add local breakpoint state:
```typescript
import { useState } from 'react';
const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
```

### 3b. Destructure `saveLayout` from context:
```typescript
const { ..., saveLayout } = useDashboard();
```

### 3c. Update `ResponsiveGridLayout` props:
```tsx
<ResponsiveGridLayout
  ...
  compactType={null}                               // FIX Bug B: no auto-compaction
  onBreakpointChange={(bp) => setCurrentBreakpoint(bp)}  // track breakpoint
  onLayoutChange={(layout) => {
    if (currentBreakpoint === 'lg') {             // FIX Bug A: only process lg
      updateLayout(layout);
    }
  }}
  onDragStop={(layout) => saveLayout(layout)}     // explicit save on user drag stop
  onResizeStop={(layout) => saveLayout(layout)}   // explicit save on user resize stop
>
```

Note: `onDragStop` and `onResizeStop` have signature `(layout, oldItem, newItem, placeholder, event, element)`. The first argument is always the full current layout — destructure just that:
```typescript
onDragStop={(layout: Layout[]) => saveLayout(layout)}
onResizeStop={(layout: Layout[]) => saveLayout(layout)}
```

---

## Step-by-Step Implementation Order

1. Edit `CardScopeMeta.tsx` — date range icon-only
2. Edit `DashboardContext.tsx` — split updateLayout / add saveLayout / update context type
3. Edit `DashboardGrid.tsx` — breakpoint tracking, compactType, stop handlers

---

## Risk Assessment

| Change | Risk | Notes |
|--------|------|-------|
| CardScopeMeta date range collapse | Low | Tooltip still shows full info |
| `compactType={null}` | Low-Medium | Charts no longer auto-fill gaps. User has full free-form control — which is the desired behavior for a custom dashboard |
| Breakpoint guard | Low | Existing layouts load correctly; just prevents corruption at smaller viewports |
| Split updateLayout/saveLayout | Low | Same logic, just separated by intent |

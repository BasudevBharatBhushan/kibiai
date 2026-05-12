# P-033 — Chart Comparison Feature — Implementation Plan

## Ticket Reference: T-033
## Scope: `fullstack`
## Status: AWAITING APPROVAL

---

## 1. Feature Overview

### What the user experiences

```
[Chart Viewer Page OR Chart Analyzer Page]
  ↓
  Each ChartCard shows a "⚖ Compare" icon button (in both User Viewer & Admin Analyzer)
  ↓
  Click "Compare"
  ↓
  A full-screen glassmorphism modal opens, split into TWO panels:

  ┌─────────────────────────────┬─────────────────────────────────────────────────┐
  │     LEFT PANEL (Primary)    │           RIGHT PANEL (Comparison)              │
  │                             │                                                 │
  │  [Primary Source Name]      │  ← Step 1: Pick a data source                  │
  │  [Date Range] [Filters]     │                                                 │
  │                             │   📋 Report History                             │
  │  [Rendered Chart]           │      • Report A (2025-01-01 – 2025-03-31)      │
  │                             │      • Report B (2025-04-01 – 2025-06-30)      │
  │                             │   ➕ Generate with New Filter                  │
  │                             │                                                 │
  │                             │  ← Step 2 (after selection):                   │
  │                             │  [Comparison Report Name]                       │
  │                             │  [Date Range] [Filters]                         │
  │                             │                                                 │
  │                             │  [Rendered Comparison Chart]                    │
  └─────────────────────────────┴─────────────────────────────────────────────────┘
```

### Modes
1. **User Mode (Viewer)**: Primary left panel is the selected historical report. Right panel is a saved report or newly generated report from the same template.
2. **Admin Mode (Analyzer)**: Primary left panel is the report template preview data. Right panel is a saved report or newly generated report from the template being configured.

### Key UX Rules
1. **Single-chart scoped**: Only the one chart the user clicked compare on is compared.
2. **Purely additive**: No writes to database except the New Filter path (which uses existing generate-report API).
3. **Same chart type**: The comparison renders the same ChartKind (bar, line, pie, etc.) as the primary.
4. **Report-history scoped**: The picker only shows reports for the same `report_template_id`.
5. **Clear labeling**: Source name, date range, and filters shown as subtitles on both panels.

---

## 2. Architecture & Data Flow

```
CompareModal (new component)
 ├── Left Panel: CompareChartPanel (receives primaryConfig: ChartConfig, primaryReportMeta)
 └── Right Panel:
      ├── [PICKING]      → ReportHistoryPicker (list of reports for template_id)
      │                     On select → fetch /api/reports/[id] → get rows + schemas
      │                     Find schema by pKey === primaryConfig.id → processData()
      │                     Switch to [VIEWING]
      │
      ├── [NEW_FILTER]   → InlineReportFilterForm (date-range + filter form)
      │                     On submit → POST /api/generate-report
      │                     On success → fetch new report → processData() → switch to [VIEWING]
      │
      └── [VIEWING]      → CompareChartPanel (comparisonConfig: ChartConfig, comparisonReport: ReportMeta)
```

### API Dependencies (No new APIs needed)

| Endpoint | Purpose | Already Exists? |
|---|---|---|
| GET /api/reports | Get list of all saved reports (for picker) | YES |
| GET /api/reports/[id] | Get report rows + schemas + config | YES |
| POST /api/generate-report | Generate report with new filter | YES |
| GET /api/report-templates/[id] | For Admin mode: fetch template info if needed | YES |

---

## 3. New Files to Create

| File | Type | Purpose |
|---|---|---|
| src/components/chart-dashboard/CompareModal.tsx | React Component | Root modal orchestrator |
| src/components/chart-dashboard/CompareChartPanel.tsx | React Component | Renders one chart + metadata header |
| src/components/chart-dashboard/ReportHistoryPicker.tsx | React Component | Report history list + new filter CTA |

### Files to Modify

| File | Change |
|---|---|
| src/components/chart-dashboard/ChartCard.tsx | Add Compare button (in both admin/viewer mode) |
| src/components/chart-dashboard/agents.md | Update architecture docs |
| src/styles/dashboard.css | Add .compare-modal-* CSS classes |

---

## 4. Detailed Component Specifications

### 4.1 ChartCard.tsx — Modification

**Change**: Add a "Compare" button to the card header. In Admin mode (`!isViewerMode`), it goes next to the type selector and delete button. In User mode (`isViewerMode`), it sits by itself.

```tsx
// New import
import { FiGitMerge } from 'react-icons/fi';

// New local state inside ChartCard
const [isCompareOpen, setIsCompareOpen] = useState(false);

// Modify header actions area:
<div className="flex items-center gap-2 pl-2 shrink-0">
  {/* Compare Button (Always visible) */}
  <button
    id={`compare-btn-${config.id}`}
    onClick={() => setIsCompareOpen(true)}
    className="compare-btn"
    title="Compare this chart with another report"
  >
    <FiGitMerge size={14} />
    <span className="compare-btn-label hidden sm:inline">Compare</span>
  </button>

  {!isViewerMode && (
    <>
      <select ... />
      <button ... className="delete-btn"><FiMinus /></button>
    </>
  )}
</div>

// Portal at bottom of return JSX:
{isCompareOpen && (
  <CompareModal
    primaryConfig={config}
    onClose={() => setIsCompareOpen(false)}
  />
)}
```

---

### 4.2 CompareModal.tsx — New Component (Core Orchestrator)

**Props**:
```typescript
interface CompareModalProps {
  primaryConfig: ChartConfig;   // The chart being compared
  onClose: () => void;
}
```

**Internal State Machine**:
```typescript
type RightPanelState = 'PICKING' | 'LOADING' | 'VIEWING' | 'NEW_FILTER' | 'GENERATING';

interface ReportMeta {
  report_id?: string; // Optional because in admin mode left panel is a template
  report_name: string;
  report_template_id: string;
  created_on?: string; // Optional for template
  report_config_json: Record<string, unknown> | null;
  report_template_setup_json: Record<string, unknown> | null;
}
```

**State variables**:
- rightPanelState: RightPanelState
- comparisonReportMeta: ReportMeta | null
- comparisonChartConfig: ChartConfig | null
- availableReports: ReportMeta[]
- isLoadingReports: boolean
- currentSourceMeta: ReportMeta | null

**Key logic on mount**:
1. Check context: are we in Admin mode (`useDashboard().isViewerMode === false`) or User mode (`isViewerMode === true`)?
2. Get `templateId` from `useDashboard()` context. This is the template ID for both modes.
3. In **User Mode**: Read `reportId` from `useParams()`. Fetch `/api/reports/[reportId]` to get the left panel metadata.
4. In **Admin Mode**: Fetch `/api/report-templates/[templateId]` to get the template name/config for the left panel metadata.
5. Fetch `/api/reports` and filter by `report_template_id === templateId` to populate `availableReports`.

**handleSelectReport(selectedId)**:
1. Set rightPanelState = 'LOADING'
2. Fetch `/api/reports/[selectedId]` → `{ rows, schemas, report_config_json }`
3. Find schema: `schemas.find(s => s.pKey === primaryConfig.id)`
4. If not found: toast error "Chart not available in this report" → back to PICKING
5. `processData(rows, [matchingSchema], insightContext)`
6. Set comparisonChartConfig = processed[0], comparisonReportMeta = fetched meta
7. Set rightPanelState = 'VIEWING'

**handleGenerateNewReport(filterPayload)**:
1. Set rightPanelState = 'GENERATING'
2. POST `/api/generate-report` with filterPayload and current `templateId`
3. On success: fetch new report_id, run same flow as handleSelectReport
4. On error: toast, back to NEW_FILTER

---

### 4.3 CompareChartPanel.tsx — New Component

Presents one side of the comparison. Header with metadata + Highcharts chart below.
```typescript
interface CompareChartPanelProps {
  config: ChartConfig;
  sourceMeta: ReportMeta | null;
  label: string;           // "Primary (Template)" | "Primary (Report)" | "Comparison"
  labelColor: 'blue' | 'purple' | 'emerald';
}
```

---

### 4.4 ReportHistoryPicker.tsx & 4.5 InlineReportFilterForm

Both components work exactly the same in Admin and User modes, displaying historical reports for the given `templateId` and allowing generation of new reports.

---

## 5. CSS Classes to Add (dashboard.css)

Add `.compare-modal-*`, `.compare-chart-panel`, `.compare-picker-*` classes. 
Responsive design will stack panels vertically below 768px.

---

## 6. Step-by-Step Execution Checklist

- [ ] **Step 1** — Append `.compare-*` CSS classes to `src/styles/dashboard.css`
- [ ] **Step 2** — Create `CompareChartPanel.tsx`
- [ ] **Step 3** — Create `ReportHistoryPicker.tsx`
- [ ] **Step 4** — Create `CompareModal.tsx` (handles both Admin and User modes)
- [ ] **Step 5** — Modify `ChartCard.tsx` (add Compare button for all modes)
- [ ] **Step 6** — Update `agents.md` in chart-dashboard directory
- [ ] **Step 7** — Run lint & build

---

## APPROVAL GATE

> **This plan must receive explicit developer approval ("Proceed" or "Approved") before any code is written.**

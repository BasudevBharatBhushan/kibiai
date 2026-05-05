# P-023 — Business Insight Assistant: Implementation Plan (v2)

**Ticket:** T-023 | **Scope:** `fullstack` | **Status:** AWAITING APPROVAL

---

## Architecture Clarifications (All Open Questions Resolved)

### Q1: Field Metadata Source
Cross-reference two JSON columns:
- `report_template_config_json.report_columns[].{field, table}` → which fields are used
- `report_template_setup_json.tables[table].fields[field].{type, label}` → metadata

Adapter maps: `config_json.report_columns` × `setup_json.tables` → `FieldSchema[]` where `meaning = label`.

Type mapping: `number` → `number`, `date` → `date`, `boolean` → `boolean`, everything else → `dimension`.

### Q2: OpenAI Integration
Uses **existing OpenAI Responses API** (`openai.responses.create`) — same pattern as report builder + chart copilot. No new assistant in dashboard. `BUSINESS_INSIGHT_SYSTEM_INSTRUCTION` passed as `instructionSet` to `ModularChatbot` → `POST /api/conversations`.

### Q3: Insight Persistence
New `insight_results jsonb` column on `report_templates`. `chart_template_canvas_state` is for chart card positions only — insights are fully separate.

### Q4: Formula Evaluator
**HyperFormula** (`licenseKey: 'gpl-v3'`).

---

## Subtask Breakdown

### ST-1 — Database Migration
**File:** `ai-workspace/sql/023_add_insight_fields.sql`

```sql
ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS insight_conversation_id varchar DEFAULT NULL;

ALTER TABLE report_templates
ADD COLUMN IF NOT EXISTS insight_results jsonb DEFAULT NULL;
```

Update `ai-workspace/docs/db-architecture.md` — add both columns to `report_templates` table.

---

### ST-2 — AI System Instruction
**File:** `src/constants/businessInsightSystemInstruction.ts`

Export `BUSINESS_INSIGHT_SYSTEM_INSTRUCTION`. Verbatim from design doc:
- Receives `{ module, fields: { name: { type, meaning } } }` — NO data
- Returns `{ insights: [{ id, category, statement_template, calculations, severity_logic }] }`
- Whitelisted: `SUM, AVERAGE, COUNT, MIN, MAX, SUMIF, SUMIFS, COUNTIF, COUNTIFS, IF, AND, OR, ROUND, ABS, DATEDIF, TODAY, YEAR, MONTH`
- No inline arithmetic inside functions; named calculations pattern only
- No row-level logic, ranking, grouping, or distinctness
- Mandatory self-validation; all 4 worked examples as binding patterns

---

### ST-3 — Insight Prompt Options
**File:** `src/constants/insightPromptOptions.ts`

`PromptOption[]` array with 6 chips: Generate Insights, Trend Analysis, Risk Indicators, Efficiency Metrics, Anomaly Detection, Opportunities.

---

### ST-4 — Field Schema Adapter
**File:** `src/lib/insights/fieldSchemaAdapter.ts`

```typescript
export interface FieldSchema {
  name: string;
  type: 'number' | 'date' | 'dimension' | 'text' | 'boolean';
  meaning: string;
}

export function deriveFieldSchemas(
  configJson: Record<string, any>,
  setupJson: Record<string, any>
): FieldSchema[]
```

Logic: Iterate `configJson.report_columns[]`, look up `setupJson.tables[col.table].fields[col.field]`, map `type` and `label → meaning`. Also processes `custom_calculated_fields`. Silently skips fields not found in setup.

---

### ST-5 — Insight Predefined Prompt Builder
**File:** `src/lib/bot/insightPromptFormatter.ts`

```typescript
export function buildInsightPredefinedPrompt(moduleName: string, fields: FieldSchema[]): string
// Returns: JSON.stringify({ module, fields: { name: { type, meaning } } })
// Schema-only — no data values ever sent

export function formatInsightPrompt(userText: string): string
// Returns userText.trim() — no .json suffix needed
```

---

### ST-6 — Insight Types
**File:** `src/lib/insights/types.ts`

```typescript
export type InsightCategory = 'trend' | 'anomaly' | 'risk' | 'opportunity' | 'efficiency' | 'quality';
export type InsightSeverity = 'high' | 'medium' | 'low';

export interface AIInsightItem {
  id: string;
  category: InsightCategory;
  statement_template: string;
  calculations: Record<string, { description: string; formula: string }>;
  severity_logic: { high: string; medium: string; low: string };
}

export interface AIInsightPlan { insights: AIInsightItem[]; }

export interface InsightResult {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  text: string;
}
```

---

### ST-7 — Insight Response Parser
**File:** `src/lib/insights/insightResponseParser.ts`

```typescript
export function parseInsightResponse(rawText: string): AIInsightPlan | null
// Extracts JSON from ```json block or raw text, validates { insights: [...] } shape
```

---

### ST-8 — Insight Formula Executor (HyperFormula)
**File:** `src/lib/insights/insightFormulaExecutor.ts`

**Privacy-safe engine: AI defines → JS executes. AI never sees dataset values.**

```typescript
export function executeInsightPlan(
  plan: AIInsightPlan,
  dataset: Record<string, unknown>[]
): InsightResult[]
```

Execution per insight:
1. **Dependency graph** — detect which named calcs reference other named calcs
2. **Topological sort** (Kahn's algorithm)
3. **Per calc in order:**
   - Pure arithmetic between resolved named calcs → `Function()` in isolated scope
   - Excel aggregate formula → HyperFormula sheet: dataset fields as columns, intermediate named calcs as extra columns, formula in evaluation cell → returns scalar
4. **`fillTemplate()`** — replaces `{placeholder}` with `toLocaleString()` formatted numbers
5. **`evaluateSeverity()`** — evaluates `high` first, then `medium`, falls back `low`

HyperFormula: `HyperFormula.buildFromSheets({ Sheet1: sheetData }, { licenseKey: 'gpl-v3' })`, `hf.getCellValue(...)`, `hf.destroy()`.

---

### ST-9 — InsightCard Component
**File:** `src/components/insights/InsightCard.tsx`

```typescript
interface InsightCardProps { insight: InsightResult; index: number; }
```

- White card, `rounded-xl shadow-sm`
- Category badge: trend=blue-600, anomaly=orange-500, risk=red-500, opportunity=green-600, efficiency=purple-600, quality=teal-600
- Severity dot: high=red-500, medium=amber-500, low=gray-400
- Staggered fade-in+slide-up animation via `animation-delay: calc(${index} * 80ms)`

---

### ST-10 — InsightDashboard Component
**File:** `src/components/insights/InsightDashboard.tsx`

```typescript
interface InsightDashboardProps { insights: InsightResult[]; isLoading: boolean; }
```

- Groups by category, section headers
- Skeleton loader (3 shimmer cards) while `isLoading`
- Empty state: lightbulb icon + guidance message
- `scrollbar-minimal` scroll container
- Renders in the right panel (replaces DashboardGrid in insight mode — charts state preserved)

---

### ST-11 — Update Charts API Response
**File:** `src/app/api/report-templates/[template_id]/charts/route.ts`

Add to SELECT query and return shape:
- `insight_conversation_id`
- `insight_results`
- `report_template_config_json`
- `report_template_setup_json`

Update `ChartBuilderResponse` TypeScript type.

---

### ST-12 — Insight Thread PATCH Route
**File:** `src/app/api/report-templates/[template_id]/insight-thread/route.ts`

Mirrors `chart-thread` route. Accepts `{ insight_conversation_id?, insight_results? }`, updates `report_templates` scoped by `company_id`.

---

### ST-13 — Mode Toggle + Full Wiring in charts/page.tsx
**File:** `src/app/[company_slug]/templates/[template_id]/charts/page.tsx`

**New state:**
```typescript
type AssistantMode = 'chart' | 'insight';
const [assistantMode, setAssistantMode] = useState<AssistantMode>('chart');
const [insightConversationId, setInsightConversationId] = useState<string | null>(initialInsightConversationId);
const [insightResults, setInsightResults] = useState<InsightResult[]>(initialInsightResults ?? []);
```

**Header:** Segmented pill toggle `[ 📊 Chart Copilot | 💡 Business Insights ]` added to `ChartHeaderActions`.

**Left panel:** Conditionally renders Chart Copilot OR Business Insight `ModularChatbot` instance based on `assistantMode`.

**Right panel:** Shows `DashboardGrid` when `assistantMode === 'chart'`, `InsightDashboard` when `assistantMode === 'insight'`.

**`insightPredefinedPrompt`:**
```typescript
const fieldSchemas = useMemo(() => deriveFieldSchemas(configJson, setupJson), [configJson, setupJson]);
const insightPredefinedPrompt = useMemo(
  () => buildInsightPredefinedPrompt(templateName, fieldSchemas),
  [templateName, fieldSchemas]
);
```

**`handleInsightResponse`:** `parseInsightResponse` → `executeInsightPlan(plan, pageData.rows)` → `setInsightResults(merged)` → `PATCH insight-thread` with `{ insight_results: merged }`.

**`handleInsightConversationIdChange`:** `setInsightConversationId(id)` → `PATCH insight-thread` with `{ insight_conversation_id: id }`.

**History restore:** Add `'"module"'` and `'"fields"'` to `hasPredefined` markers in `ModularChatbot`'s conversation restore logic so the schema JSON is stripped from displayed user messages.

---

### ST-14 — Remove Business Insight from Chart Copilot
- `src/constants/chartsSystemInstruction.ts` — remove "Expected Output Format for Business Insight" section
- `charts/page.tsx` — remove `business_insights` branches from `handleAssistantResponse()`
- Update Chart Copilot welcome message to reference the new mode

---

## Data Flow

```
USER: switch to "Business Insights" mode
        │
        ▼  initialConversationId loaded from DB (insight_conversation_id)
ModularChatbot (insight instance) — past messages restored via getConversation()
        │
        ▼  predefinedPrompt (schema JSON — ZERO data values):
        │  { "module": "Sales", "fields": {
        │    "Quantity":  { "type": "number", "meaning": "Quantity" },
        │    "LinePrice": { "type": "number", "meaning": "Line Price" },
        │    "SalesDate": { "type": "date",   "meaning": "Sales Date" }
        │  }}
        │
        ▼  POST /api/conversations
sendUserPrompt() → openai.responses.create({
  instructions: BUSINESS_INSIGHT_SYSTEM_INSTRUCTION,
  conversation: conversationId,
  input: [{ role: "user", content: schema_json + "\n" + userText }]
})
        │
        ▼  AI returns: { "insights": [{ id, category, statement_template, calculations, severity_logic }] }
parseInsightResponse() → AIInsightPlan
        │
        ▼  JS EXECUTES — AI NEVER SEES DATASET
executeInsightPlan(plan, pageData.rows)
  ├── Topo sort calculations
  ├── HyperFormula evaluates Excel formulas on dataset columns
  ├── fillTemplate(): "{totalSales}" → "124,500"
  └── evaluateSeverity(): "high" | "medium" | "low"
        │
        ▼  InsightResult[]
InsightDashboard → InsightCard (per result)
PATCH /api/report-templates/.../insight-thread → insight_results saved to DB
```

---

## File Summary

| # | Action | File |
|---|--------|------|
| ST-1 | CREATE | `ai-workspace/sql/023_add_insight_fields.sql` |
| ST-1 | UPDATE | `ai-workspace/docs/db-architecture.md` |
| ST-2 | CREATE | `src/constants/businessInsightSystemInstruction.ts` |
| ST-3 | CREATE | `src/constants/insightPromptOptions.ts` |
| ST-4 | CREATE | `src/lib/insights/fieldSchemaAdapter.ts` |
| ST-5 | CREATE | `src/lib/bot/insightPromptFormatter.ts` |
| ST-6 | CREATE | `src/lib/insights/types.ts` |
| ST-7 | CREATE | `src/lib/insights/insightResponseParser.ts` |
| ST-8 | CREATE | `src/lib/insights/insightFormulaExecutor.ts` |
| ST-9 | CREATE | `src/components/insights/InsightCard.tsx` |
| ST-10 | CREATE | `src/components/insights/InsightDashboard.tsx` |
| ST-11 | MODIFY | `src/app/api/report-templates/[template_id]/charts/route.ts` |
| ST-12 | CREATE | `src/app/api/report-templates/[template_id]/insight-thread/route.ts` |
| ST-13 | MODIFY | `src/app/[company_slug]/templates/[template_id]/charts/page.tsx` |
| ST-14 | MODIFY | `src/constants/chartsSystemInstruction.ts` |

---

## Execution Order

```
ST-1  → DB migration (prerequisite)
ST-2  → businessInsightSystemInstruction.ts
ST-3  → insightPromptOptions.ts
ST-4  → fieldSchemaAdapter.ts
ST-5  → insightPromptFormatter.ts
ST-6  → types.ts
ST-7  → insightResponseParser.ts
ST-8  → insightFormulaExecutor.ts (needs ST-6 + HyperFormula)
ST-9  → InsightCard.tsx (needs ST-6)
ST-10 → InsightDashboard.tsx (needs ST-9)
ST-11 → Update charts API (needs ST-1)
ST-12 → insight-thread route (needs ST-1)
ST-13 → charts/page.tsx wiring (needs ST-2..12)
ST-14 → Remove from Chart Copilot (final cleanup)
```

---

## Verification Checklist
- [ ] `npm run lint` zero errors
- [ ] `npm run build` succeeds
- [ ] Mode toggle switches chatbot without page reload
- [ ] Insight conversation ID persists after page refresh
- [ ] Switching to insight mode restores past conversation messages
- [ ] Network tab: schema JSON in predefined prompt, NO data values
- [ ] Insight cards render with correct category badge + severity dot
- [ ] `insight_results` updated in Supabase after generation
- [ ] Chart Copilot no longer processes `business_insights` responses
- [ ] Existing chart generation unaffected

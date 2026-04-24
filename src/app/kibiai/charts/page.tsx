"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Bot, PanelLeft, Sparkles } from "lucide-react";

import Dashboard from "@/components/chart-dashboard/DashboardGrid";
import { ModularChatbot } from "@/components/chat/ModularChatbot";
import { CHARTS_SYSTEM_INSTRUCTION } from "@/constants/chartsSystemInstruction";
import { CHART_PROMPT_OPTIONS } from "@/constants/chartPromptOptions";
import { formatChartPrompt } from "@/lib/bot/chartPromptFormatter";
import { ReportChartSchema } from "@/lib/charts/ChartTypes";
import { useDashboard } from "@/context/DashboardContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { useToast } from "@/context/ToastContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartConfigData {
  reportRecordId: string | null;
  fieldNames: string[];
  reportInsight: string | null;
  chartThreadId: string | null;
}

interface ChartPageData {
  schemas: ReportChartSchema[];
  rows: any[];
  canvasState: any[];
  layoutMode: string;
  reportRecordId: string;
}

// ─── Utility: Parse AI JSON response ─────────────────────────────────────────

function extractJson(raw: string): any | null {
  try {
    let jsonStr = raw.trim();
    const fenced = jsonStr.match(/```json\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
    if (fenced) jsonStr = fenced[1];
    else {
      const plain = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (plain) jsonStr = plain[1];
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ─── Suggestion Chips Component ───────────────────────────────────────────────

function SuggestionChips({
  suggestions,
  onSelect,
}: {
  suggestions: string[];
  onSelect: (text: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="px-4 pb-2 flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Suggested Charts
      </p>
      <div className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s)}
            className="text-left text-[12px] rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-700 font-medium hover:bg-indigo-100 hover:border-indigo-300 transition-all active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Inner Charts Page (needs DashboardContext) ───────────────────────────────

function ChartsPageInner({
  reportId,
  configData,
  pageData,
  onChartSuggestionSelect,
  pendingSuggestion,
  onSuggestionConsumed,
}: {
  reportId: string;
  configData: ChartConfigData;
  pageData: ChartPageData | null;
  onChartSuggestionSelect: (text: string) => void;
  pendingSuggestion: string;
  onSuggestionConsumed: () => void;
}) {
  const { addNewChartFromAI, addMultipleChartsFromAI } = useDashboard();
  const { addToast } = useToast();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(
    configData.chartThreadId
  );
  const [chartSuggestions, setChartSuggestions] = useState<string[]>([]);

  // Sync conversation ID when config loads
  useEffect(() => {
    if (configData.chartThreadId) {
      setConversationId(configData.chartThreadId);
    }
  }, [configData.chartThreadId]);

  // ─ Format prompt with field names + report insight
  const formatPrompt = useCallback(
    (userText: string) => {
      return formatChartPrompt(
        userText,
        configData.fieldNames,
        configData.reportInsight ?? undefined
      );
    },
    [configData.fieldNames, configData.reportInsight]
  );

  // ─ Persist a new chart record to FileMaker
  const persistChartToFM = useCallback(
    async (schema: ReportChartSchema, aiJsonString: string) => {
      if (!configData.reportRecordId) return;
      try {
        await fetch("/api/charts/chart-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportRecordId: configData.reportRecordId,
            chartRecord: {
              reportId,
              aiJsonResponse: aiJsonString,
            },
          }),
        });
      } catch (e) {
        console.error("[Charts] Failed to persist chart to FM:", e);
      }
    },
    [configData.reportRecordId, reportId]
  );

  // ─ Persist thread ID to FileMaker
  const handleConversationIdChange = useCallback(
    async (id: string | null) => {
      setConversationId(id);
      if (id && configData.reportRecordId) {
        try {
          await fetch("/api/charts/chart-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportRecordId: configData.reportRecordId,
              chartThreadId: id,
            }),
          });
        } catch (e) {
          console.error("[Charts] Failed to sync thread ID:", e);
        }
      }
    },
    [configData.reportRecordId]
  );

  // ─ Handle AI response from ModularChatbot
  const handleAssistantResponse = useCallback(
    async (displayedText: string, rawResponseText: string) => {
      const parsed = extractJson(rawResponseText || displayedText);
      if (!parsed) return;

      // Clear old suggestions
      setChartSuggestions([]);

      // ── Scenario 3: Chart Suggestions ──────────────────────────────────
      if (parsed.chart_suggestions && Array.isArray(parsed.chart_suggestions)) {
        setChartSuggestions(parsed.chart_suggestions);
        return;
      }

      // ── Scenario 4: Report Analysis (multi-response array) ─────────────
      if (parsed.responses && Array.isArray(parsed.responses)) {
        const chartSchemas: ReportChartSchema[] = [];

        for (const item of parsed.responses) {
          if (!item) continue;
          const aiStr = JSON.stringify(item);

          if (item.business_insights) {
            // Business insight within report analysis
            const schema: ReportChartSchema = {
              pKey: `insight-${Date.now()}-${Math.random()}`,
              chart_title: "Business Insights",
              chart_type: "insight",
              business_insights: item.business_insights,
              response_to_user: item.response_to_user,
            };
            chartSchemas.push(schema);
            persistChartToFM(schema, aiStr);
          } else if (item.chart_type && item.group_field) {
            // Chart within report analysis
            const schema: ReportChartSchema = {
              pKey: `chart-${Date.now()}-${Math.random()}`,
              chart_title: item.chart_title ?? "Chart",
              chart_type: item.chart_type,
              numerical_field: item.numerical_field,
              group_field: item.group_field,
              subgroup_field: item.subgroup_field,
              mathematical_aggregation_method: item.mathematical_aggregation_method,
              filters: item.filters,
              response_to_user: item.response_to_user,
            };
            chartSchemas.push(schema);
            persistChartToFM(schema, aiStr);
          }
        }

        if (chartSchemas.length > 0) {
          addMultipleChartsFromAI(chartSchemas);
          addToast("success", "Charts Added", `Added ${chartSchemas.length} chart(s) to the dashboard.`);
        }
        return;
      }

      // ── Scenario 2: Business Insights ──────────────────────────────────
      if (parsed.business_insights && Array.isArray(parsed.business_insights)) {
        const schema: ReportChartSchema = {
          pKey: `insight-${Date.now()}`,
          chart_title: "Business Insights",
          chart_type: "insight",
          business_insights: parsed.business_insights,
          response_to_user: parsed.response_to_user,
        };
        addNewChartFromAI(schema);
        persistChartToFM(schema, JSON.stringify(parsed));
        addToast("success", "Insights Added", "Business insights added to the dashboard.");
        return;
      }

      // ── Scenario 1 & 5: Single Chart / Comparison Chart ───────────────
      if (parsed.chart_type && parsed.group_field) {
        const schema: ReportChartSchema = {
          pKey: `chart-${Date.now()}`,
          chart_title: parsed.chart_title ?? "Chart",
          chart_type: parsed.chart_type,
          numerical_field: parsed.numerical_field,
          group_field: parsed.group_field,
          subgroup_field: parsed.subgroup_field,
          mathematical_aggregation_method: parsed.mathematical_aggregation_method,
          filters: parsed.filters,
          response_to_user: parsed.response_to_user,
        };
        addNewChartFromAI(schema);
        persistChartToFM(schema, JSON.stringify(parsed));
        addToast("success", "Chart Added", `"${schema.chart_title}" added to the dashboard.`);
      }
    },
    [addNewChartFromAI, addMultipleChartsFromAI, persistChartToFM, addToast]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">
      {/* ── Page Header ── */}
      <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur flex items-center justify-between gap-4 z-20">
        {/* Left: Title */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tighter text-indigo-700 italic">
                KiBiAI
              </h1>
              <span className="text-slate-300 font-light">/</span>
              <span className="truncate text-sm font-medium text-slate-600">
                Chart Dashboard
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wide text-slate-500">
              ReportId: {reportId}
            </span>
          </div>
        </div>

        {/* Right: Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
          <button
            onClick={() => setIsChatOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all ${
              isChatOpen
                ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            }`}
            title="Toggle Chart Copilot"
            aria-pressed={isChatOpen}
          >
            <PanelLeft size={16} strokeWidth={isChatOpen ? 2 : 1.5} />
            <span className="hidden sm:inline-block text-[11px] font-semibold tracking-wide">
              Copilot
            </span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── COLUMN 1: Chat Copilot (Left) ── */}
        <div
          className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 ${
            isChatOpen ? "w-[420px]" : "w-0 border-none overflow-hidden"
          }`}
        >
          <div className="flex-1 overflow-hidden flex flex-col min-w-[420px]">
            {/* Suggestion Chips (above chatbot input) */}
            {chartSuggestions.length > 0 && (
              <SuggestionChips
                suggestions={chartSuggestions}
                onSelect={(text) => {
                  setChartSuggestions([]);
                  onChartSuggestionSelect(text);
                }}
              />
            )}

            <ModularChatbot
              botName="Chart Copilot"
              instructionSet={CHARTS_SYSTEM_INSTRUCTION}
              formatPrompt={formatPrompt}
              suggestedPrompts={CHART_PROMPT_OPTIONS}
              initialConversationId={conversationId}
              onAssistantResponse={handleAssistantResponse}
              onConversationIdChange={handleConversationIdChange}
              className="h-full w-full flex flex-col bg-white overflow-hidden relative"
              welcomeMessage="Hello! I am the Chart Copilot. I can help you generate charts, business insights, and analysis from your report data. What would you like to visualize?"
              pendingInput={pendingSuggestion}
              onPendingInputConsumed={onSuggestionConsumed}
            />
          </div>
        </div>

        {/* ── COLUMN 2: Dashboard Grid (Main) ── */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <Dashboard
            initialSchemas={pageData?.schemas ?? []}
            initialDataset={pageData?.rows ?? []}
            initialCanvasState={pageData?.canvasState ?? []}
            initialLayoutMode={pageData?.layoutMode ?? "grid"}
            reportRecordId={pageData?.reportRecordId ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg animate-pulse">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div className="space-y-2 text-center">
          <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper Component that handles data loading + DashboardProvider ──────────

function ChartsPageWrapper() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report_id") ?? "";
  const { addToast } = useToast();

  const [configData, setConfigData] = useState<ChartConfigData>({
    reportRecordId: null,
    fieldNames: [],
    reportInsight: null,
    chartThreadId: null,
  });
  const [pageData, setPageData] = useState<ChartPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // For passing suggestion clicks into the chatbot
  const [pendingSuggestion, setPendingSuggestion] = useState("");
  const handleSuggestionConsumed = useCallback(() => setPendingSuggestion(""), []);

  useEffect(() => {
    if (!reportId) {
      setIsLoading(false);
      return;
    }

    async function loadAll() {
      setIsLoading(true);
      try {
        const [configRes, dataRes] = await Promise.all([
          fetch(`/api/charts/chart-config?report_id=${reportId}`),
          fetch(`/api/charts/data?report_id=${reportId}`),
        ]);

        if (configRes.ok) {
          const cfg = await configRes.json();
          setConfigData({
            reportRecordId: cfg.reportRecordId ?? null,
            fieldNames: cfg.fieldNames ?? [],
            reportInsight: cfg.reportInsight ?? null,
            chartThreadId: cfg.chartThreadId ?? null,
          });
        } else {
          addToast("error", "Load Error", "Failed to load chart configuration.");
        }

        if (dataRes.ok) {
          const d = await dataRes.json();
          setPageData({
            schemas: d.schemas ?? [],
            rows: d.rows ?? [],
            canvasState: d.canvasState ?? [],
            layoutMode: d.layoutMode ?? "grid",
            reportRecordId: d.reportRecordId ?? "",
          });
        } else {
          addToast("error", "Load Error", "Failed to load chart data.");
        }
      } catch (e) {
        console.error("[ChartsPage] Load error:", e);
        addToast("error", "Error", "An error occurred while loading the dashboard.");
      } finally {
        setIsLoading(false);
      }
    }

    loadAll();
  }, [reportId, addToast]);

  if (!reportId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center space-y-2">
          <Bot className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium">Please provide a report_id in the URL</p>
          <p className="text-xs text-slate-400">e.g. ?report_id=12</p>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  return (
    <DashboardProvider
      initialSchemas={pageData?.schemas ?? []}
      initialDataset={pageData?.rows ?? []}
      initialCanvasState={pageData?.canvasState ?? []}
      initialLayoutMode={pageData?.layoutMode ?? "grid"}
      reportRecordId={pageData?.reportRecordId ?? ""}
    >
      <ChartsPageInner
        reportId={reportId}
        configData={configData}
        pageData={pageData}
        onChartSuggestionSelect={setPendingSuggestion}
        pendingSuggestion={pendingSuggestion}
        onSuggestionConsumed={handleSuggestionConsumed}
      />
    </DashboardProvider>
  );
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default function ChartsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ChartsPageWrapper />
    </Suspense>
  );
}

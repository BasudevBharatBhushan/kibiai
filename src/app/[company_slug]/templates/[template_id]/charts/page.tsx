"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { BarChart3, FileText, Lightbulb, Loader2, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import DashboardGrid from "@/components/chart-dashboard/DashboardGrid";
import DynamicReport from "@/components/DynamicReportPreview";
import { buildReportMetadata } from "@/lib/utils/reportMetadata";

import { ModularChatbot } from "@/components/chat/ModularChatbot";
import { CHART_PROMPT_OPTIONS } from "@/constants/chartPromptOptions";
import { CHARTS_SYSTEM_INSTRUCTION } from "@/constants/chartsSystemInstruction";
import { BUSINESS_INSIGHT_SYSTEM_INSTRUCTION } from "@/constants/businessInsightSystemInstruction";
import { INSIGHT_PROMPT_OPTIONS } from "@/constants/insightPromptOptions";
import { DashboardProvider, useDashboard } from "@/context/DashboardContext";
import { useHeader } from "@/context/HeaderContext";
import { useToast } from "@/context/ToastContext";
import {
  buildChartPredefinedPrompt,
  formatChartPrompt,
} from "@/lib/bot/chartPromptFormatter";
import {
  buildInsightPredefinedPrompt,
  formatInsightPrompt,
} from "@/lib/bot/insightPromptFormatter";
import {
  CHART_BOOTSTRAP_ANALYSIS_PROMPT,
  shouldBootstrapStarterCharts,
} from "@/lib/charts/bootstrap";
import type { ReportChartSchema } from "@/lib/charts/ChartTypes";
import { deriveFieldSchemas } from "@/lib/insights/fieldSchemaAdapter";
import { executeInsightPlan } from "@/lib/insights/insightFormulaExecutor";
import { parseInsightResponse } from "@/lib/insights/insightResponseParser";
import type { InsightResult } from "@/lib/insights/types";
import { apiClient } from "@/utils/apiClient";

type AssistantMode = "chart" | "insight";

type ChartBuilderResponse = {
  template_id: string;
  template_name: string;
  chart_conversation_id: string | null;
  insight_conversation_id: string | null;
  insight_results: InsightResult[] | null;
  report_template_config_json: Record<string, unknown> | null;
  report_template_setup_json: Record<string, unknown> | null;
  report_template_data_json: unknown;
  report_insight: string | null;
  fieldNames: string[];
  rows: Array<Record<string, unknown>>;
  schemas: ReportChartSchema[];
  canvasState: Array<Record<string, unknown>>;
  layoutMode: string;
};

type ParsedChartAssistantItem = Partial<ReportChartSchema> & {
  business_insights?: string[];
  response_to_user?: string;
};

type ParsedChartAssistantResponse = ParsedChartAssistantItem & {
  responses?: ParsedChartAssistantItem[];
  chart_suggestions?: string[];
};

function extractJson(raw: string): ParsedChartAssistantResponse | null {
  try {
    let jsonStr = raw.trim();
    const fenced = jsonStr.match(/```json\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
    if (fenced) jsonStr = fenced[1];
    else {
      const plain = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (plain) jsonStr = plain[1];
    }
    return JSON.parse(jsonStr) as ParsedChartAssistantResponse;
  } catch {
    return null;
  }
}



function LoadingSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg animate-pulse">
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

function ChartHeaderActions({
  isChatOpen,
  isConfigOpen,
  isPreviewOpen,
  onToggleChat,
  onToggleConfig,
  onTogglePreview,
}: {
  isChatOpen: boolean;
  isConfigOpen: boolean;
  isPreviewOpen: boolean;
  onToggleChat: () => void;
  onToggleConfig: () => void;
  onTogglePreview: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all text-[11px] font-semibold ${
            isChatOpen
              ? "bg-white text-blue-600 shadow-sm border border-blue-100"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          }`}
          title="Toggle Chat Panel"
          aria-pressed={isChatOpen}
        >
          <PanelLeft size={14} strokeWidth={isChatOpen ? 2 : 1.5} />
          <span className="hidden sm:inline">Copilot</span>
        </button>
        <button
          onClick={onToggleConfig}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all text-[11px] font-semibold ${
            isConfigOpen
              ? "bg-white text-slate-800 shadow-sm border border-slate-200"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          }`}
          title="Configure Charts (closes Preview)"
          aria-pressed={isConfigOpen}
        >
          <PanelRight size={14} strokeWidth={isConfigOpen ? 2 : 1.5} />
          <span className="hidden sm:inline">Configure</span>
        </button>
        <button
          onClick={onTogglePreview}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all text-[11px] font-semibold ${
            isPreviewOpen
              ? "bg-white text-emerald-700 shadow-sm border border-emerald-100"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          }`}
          title="Preview Report (closes Configure)"
          aria-pressed={isPreviewOpen}
        >
          <FileText size={14} strokeWidth={isPreviewOpen ? 2 : 1.5} />
          <span className="hidden sm:inline">Preview</span>
        </button>
      </div>
    </div>
  );
}

function ChartBuilderWorkspace({
  templateId,
  templateName,
  fieldNames,
  reportInsight,
  initialConversationId,
  initialInsightConversationId,
  initialInsightResults,
  configJson,
  setupJson,
  rows,
  shouldBootstrapCharts,
  reportDataJson,
}: {
  templateId: string;
  templateName: string;
  fieldNames: string[];
  reportInsight: string | null;
  initialConversationId: string | null;
  initialInsightConversationId: string | null;
  initialInsightResults: InsightResult[] | null;
  configJson: Record<string, unknown> | null;
  setupJson: Record<string, unknown> | null;
  rows: Array<Record<string, unknown>>;
  shouldBootstrapCharts: boolean;
  reportDataJson: unknown;
}) {
  const {
    addNewChartFromAI,
    addMultipleChartsFromAI,
    isEditOpen,
    setEditOpen,
  } = useDashboard();
  const { addToast } = useToast();
  const { resetHeader, setHeaderActions } = useHeader();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("chart");
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [insightConversationId, setInsightConversationId] = useState<string | null>(initialInsightConversationId);

  // Normalize the template's preview data into the shape DynamicReport expects.
  const previewJsonData = useMemo<any[]>(() => {
    if (!reportDataJson) return [];
    if (Array.isArray(reportDataJson)) return reportDataJson;
    return [];
  }, [reportDataJson]);

  const previewMetadata = useMemo(
    () => buildReportMetadata(configJson, setupJson),
    [configJson, setupJson]
  );

  const [insightLoading, setInsightLoading] = useState(false);
  const [chartSuggestions, setChartSuggestions] = useState<string[]>([]);
  const [pendingSuggestion, setPendingSuggestion] = useState("");
  const [isAutoGeneratingCharts, setIsAutoGeneratingCharts] = useState(false);
  const hasBootstrappedRef = useRef(false);

  useEffect(() => { setConversationId(initialConversationId); }, [initialConversationId]);
  useEffect(() => { setInsightConversationId(initialInsightConversationId); }, [initialInsightConversationId]);

  const formatPrompt = useCallback((userText: string) => formatChartPrompt(userText), []);
  const predefinedPrompt = useMemo(
    () => buildChartPredefinedPrompt(fieldNames, setupJson, configJson),
    [fieldNames, setupJson, configJson]
  );

  const fieldSchemas = useMemo(
    () => deriveFieldSchemas(configJson, setupJson),
    [configJson, setupJson]
  );
  const insightPredefinedPrompt = useMemo(
    () => buildInsightPredefinedPrompt(templateName, fieldSchemas),
    [templateName, fieldSchemas]
  );
  const toggleChat = useCallback(() => setIsChatOpen((prev) => !prev), []);
  const toggleConfig = useCallback(() => {
    const next = !isEditOpen;
    if (next) setIsPreviewOpen(false); // mutually exclusive with preview
    setEditOpen(next);
  }, [isEditOpen, setEditOpen]);
  const togglePreview = useCallback(() => {
    setIsPreviewOpen((prev) => {
      const next = !prev;
      if (next) setEditOpen(false); // mutually exclusive with configure
      return next;
    });
  }, [setEditOpen]);

  useLayoutEffect(() => {
    setHeaderActions(
      <ChartHeaderActions
        isChatOpen={isChatOpen}
        isConfigOpen={isEditOpen}
        isPreviewOpen={isPreviewOpen}
        onToggleChat={toggleChat}
        onToggleConfig={toggleConfig}
        onTogglePreview={togglePreview}
      />
    );
  }, [isChatOpen, isEditOpen, isPreviewOpen, assistantMode, setHeaderActions, toggleChat, toggleConfig, togglePreview]);

  useLayoutEffect(() => {
    return () => setHeaderActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldBootstrapCharts || hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    setIsAutoGeneratingCharts(true);
    setPendingSuggestion(CHART_BOOTSTRAP_ANALYSIS_PROMPT);
  }, [shouldBootstrapCharts]);

  const persistChartToSupabase = useCallback(
    async (schema: ReportChartSchema) => {
      await apiClient.post(`/api/report-templates/${templateId}/charts`, {
        chart: schema,
      });
    },
    [templateId]
  );

  const handleConversationIdChange = useCallback(
    async (id: string | null) => {
      setConversationId(id);
      await apiClient.patch(`/api/report-templates/${templateId}/chart-thread`, {
        chart_conversation_id: id,
      });
    },
    [templateId]
  );

  const handleInsightConversationIdChange = useCallback(
    async (id: string | null) => {
      setInsightConversationId(id);
      await apiClient.patch(`/api/report-templates/${templateId}/insight-thread`, {
        insight_conversation_id: id,
      });
    },
    [templateId]
  );

  const handleInsightResponse = useCallback(
    async (displayedText: string, rawResponseText: string) => {
      setInsightLoading(true);
      try {
        const plan = parseInsightResponse(rawResponseText || displayedText);
        if (!plan) {
          addToast("error", "Failed to parse AI response", "The AI did not return a valid insight JSON structure.");
          return;
        }

        let reportStart: string | undefined;
        let reportEnd: string | undefined;
        let rangeFieldLabel: string | undefined;

        if (configJson?.date_range_fields) {
          const dateRanges = configJson.date_range_fields as Record<string, Record<string, string>>;
          for (const [table, tableFields] of Object.entries(dateRanges)) {
            for (const [field, rangeStr] of Object.entries(tableFields)) {
              const parts = rangeStr.split("...");
              if (parts.length === 2) {
                const startD = new Date(parts[0]);
                const endD = new Date(parts[1]);
                if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                  reportStart = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
                  reportEnd = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
                  
                  let label = `${table}::${field}`;
                  if (setupJson?.tables) {
                    const tables = setupJson.tables as any;
                    if (tables[table]?.fields?.[field]?.label) {
                      label = tables[table].fields[field].label;
                    }
                  }
                  rangeFieldLabel = label;
                  
                  break;
                }
              }
            }
            if (reportStart) break;
          }
        }

        const context = { reportStart, reportEnd };
        const schemas = deriveFieldSchemas(configJson, setupJson);
        const results = executeInsightPlan(plan, rows, context, schemas);
        if (!results.length) {
          addToast("warning", "No valid insights", "The AI generated insights but they failed validation or returned zero results.");
          return;
        }
        
        const schema: ReportChartSchema = {
          pKey: crypto.randomUUID(),
          chart_title: "Business Insights",
          chart_type: "insight",
          insight_plan: plan,
          insight_results: results,
          response_to_user: plan.response_to_user,
        };

        if (reportStart && reportEnd && rangeFieldLabel) {
          schema.insight_date_range = {
            field: rangeFieldLabel,
            start: reportStart,
            end: reportEnd,
          };
        }

        addNewChartFromAI(schema);
        await persistChartToSupabase(schema);
        await apiClient.patch(`/api/report-templates/${templateId}/insight-thread`, {
          insight_results: results,
        });

        addToast("success", "Insights Generated", `${results.length} business insight(s) added to dashboard.`);
      } catch (error: any) {
        addToast("error", "Insight Generation Error", error.message || "An unexpected error occurred while processing the insight.");
      } finally {
        setInsightLoading(false);
      }
    },
    [rows, templateId, addToast, addNewChartFromAI, persistChartToSupabase, configJson, setupJson]
  );

  const currentMode = assistantMode;

  const createSchemaId = () => crypto.randomUUID();

  const handleAssistantResponse = useCallback(
    async (displayedText: string, rawResponseText: string) => {
      const parsed = extractJson(rawResponseText || displayedText);
      if (!parsed) return;

      // Suggestions are now handled internally by ModularChatbot via showAiSuggestions
      setChartSuggestions([]);


      if (parsed.responses && Array.isArray(parsed.responses)) {
        const chartSchemas: ReportChartSchema[] = [];

        parsed.responses.forEach((item) => {
          if (!item) return;

          if (item.business_insights) {
            let reportStart: string | undefined;
            let reportEnd: string | undefined;
            let rangeFieldLabel: string | undefined;

            if (configJson?.date_range_fields) {
              const dateRanges = configJson.date_range_fields as Record<string, Record<string, string>>;
              for (const [table, tableFields] of Object.entries(dateRanges)) {
                for (const [field, rangeStr] of Object.entries(tableFields)) {
                  const parts = rangeStr.split("...");
                  if (parts.length === 2) {
                    const startD = new Date(parts[0]);
                    const endD = new Date(parts[1]);
                    if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                      reportStart = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
                      reportEnd = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
                      
                      let label = `${table}::${field}`;
                      if (setupJson?.tables) {
                        const tables = setupJson.tables as any;
                        if (tables[table]?.fields?.[field]?.label) {
                          label = tables[table].fields[field].label;
                        }
                      }
                      rangeFieldLabel = label;
                      break;
                    }
                  }
                }
                if (reportStart) break;
              }
            }

            const schema: ReportChartSchema = {
              pKey: createSchemaId(),
              chart_title: "Business Insights",
              chart_type: "insight",
              business_insights: item.business_insights,
              insight_plan: item.insight_plan, // If the chart copilot also returns a plan
              response_to_user: item.response_to_user,
            };

            if (reportStart && reportEnd && rangeFieldLabel) {
              schema.insight_date_range = {
                field: rangeFieldLabel,
                start: reportStart,
                end: reportEnd,
              };
            }

            chartSchemas.push(schema);
            return;
          }

          if (item.chart_type && item.group_field) {
            chartSchemas.push({
              pKey: createSchemaId(),
              chart_title: item.chart_title ?? "Chart",
              chart_type: item.chart_type,
              numerical_field: item.numerical_field,
              group_field: item.group_field,
              subgroup_field: item.subgroup_field,
              mathematical_aggregation_method:
                item.mathematical_aggregation_method,
              filters: item.filters,
              response_to_user: item.response_to_user,
            });
          }
        });

        if (!chartSchemas.length) return;

        addMultipleChartsFromAI(chartSchemas);
        await Promise.all(chartSchemas.map(persistChartToSupabase));
        addToast(
          "success",
          "Charts Added",
          `Added ${chartSchemas.length} chart(s) to the dashboard.`
        );
        return;
      }

      if (parsed.chart_type && parsed.group_field) {
        const schema: ReportChartSchema = {
          pKey: createSchemaId(),
          chart_title: parsed.chart_title ?? "Chart",
          chart_type: parsed.chart_type,
          numerical_field: parsed.numerical_field,
          group_field: parsed.group_field,
          subgroup_field: parsed.subgroup_field,
          mathematical_aggregation_method:
            parsed.mathematical_aggregation_method,
          filters: parsed.filters,
          response_to_user: parsed.response_to_user,
        };
        addNewChartFromAI(schema);
        await persistChartToSupabase(schema);
        addToast(
          "success",
          "Chart Added",
          `"${schema.chart_title}" added to the dashboard.`
        );
      }
    },
    [
      addMultipleChartsFromAI,
      addNewChartFromAI,
      addToast,
      persistChartToSupabase,
      configJson,
      setupJson,
    ]
  );

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 relative flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans">
      <div className="flex flex-1 overflow-hidden relative w-full">
        <div
          className={`bg-white border-r border-slate-200 h-full shadow-xl z-20 transition-[width] duration-300 ease-in-out flex flex-col shrink-0 ${
            isChatOpen ? "w-[400px]" : "w-0 border-none overflow-hidden"
          }`}
        >
          <div className="flex-1 overflow-hidden relative flex flex-col min-w-[400px]">
            {/* Chart Copilot */}
            {assistantMode === "chart" && (
              <>

                <ModularChatbot
                  botName="Charts"
                  instructionSet={CHARTS_SYSTEM_INSTRUCTION}
                  predefinedPrompt={predefinedPrompt}
                  formatPrompt={formatPrompt}
                  suggestedPrompts={CHART_PROMPT_OPTIONS}
                  initialConversationId={conversationId}
                  onAssistantResponse={handleAssistantResponse}
                  onConversationIdChange={handleConversationIdChange}
                  className="h-full w-full flex flex-col bg-white overflow-hidden relative"
                  welcomeMessage="Hello! I am the Chart Copilot. I help you generate charts and visualizations from your report data. Switch to Insights mode for deep analysis."
                  pendingInput={pendingSuggestion}
                  onPendingInputConsumed={() => setPendingSuggestion("")}
                  onLoadingChange={(loading) => {
                    if (!loading && isAutoGeneratingCharts) setIsAutoGeneratingCharts(false);
                  }}
                  showAiSuggestions={true}
                  showSetupCheckbox={true}
                  headerActions={
                    <div className="flex items-center gap-1.5 mr-1 bg-slate-100/50 p-1 rounded-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAssistantMode("chart")}
                        className={`size-7 rounded-md ${currentMode === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        title="Switch to Chart Copilot"
                      >
                        <BarChart3 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAssistantMode("insight")}
                        className={`size-7 rounded-md ${currentMode === 'insight' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                        title="Switch to Business Insights"
                      >
                        <Lightbulb className="size-4" />
                      </Button>
                    </div>
                  }
                />
              </>
            )}

            {/* Business Insight Assistant */}
            {assistantMode === "insight" && (
              <ModularChatbot
                botName="Insights"
                instructionSet={BUSINESS_INSIGHT_SYSTEM_INSTRUCTION}
                predefinedPrompt={insightPredefinedPrompt}
                formatPrompt={formatInsightPrompt}
                suggestedPrompts={INSIGHT_PROMPT_OPTIONS}
                initialConversationId={insightConversationId}
                onAssistantResponse={handleInsightResponse}
                onConversationIdChange={handleInsightConversationIdChange}
                onLoadingChange={setInsightLoading}
                className="h-full w-full flex flex-col bg-white overflow-hidden relative"
                welcomeMessage={`Hello! I am the Business Insight Assistant. I analyze your report schema and generate structured insights — without ever seeing your actual data.\n\nI have mapped ${fieldSchemas.length} field(s) from your template. Ask me to generate insights!`}
                showAiSuggestions={true}
                showSetupCheckbox={true}
                headerActions={
                  <div className="flex items-center gap-1.5 mr-1 bg-slate-100/50 p-1 rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAssistantMode("chart")}
                      className={`size-7 rounded-md ${currentMode === 'chart' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                      title="Switch to Chart Copilot"
                    >
                      <BarChart3 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAssistantMode("insight")}
                      className={`size-7 rounded-md ${currentMode === 'insight' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
                      title="Switch to Business Insights"
                    >
                      <Lightbulb className="size-4" />
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </div>

        <div className="relative z-0 flex-1 flex overflow-hidden bg-slate-50">
          <DashboardGrid />
        </div>

        {/* Report Preview pane — mutex with the configure (EditPanel) pane */}
        <div
          className={`bg-slate-100 border-l-2 border-slate-300 h-full shadow-[-6px_0_18px_-6px_rgba(15,23,42,0.18)] z-20 transition-[width] duration-300 ease-in-out flex flex-col shrink-0 ${
            isPreviewOpen ? "w-[640px]" : "w-0 border-none overflow-hidden"
          }`}
        >
          {isPreviewOpen && (
            <div className="flex-1 flex flex-col min-w-[640px] overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <FileText size={14} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">Template Preview</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{templateName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Close preview"
                >
                  <PanelRight size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-200">
                {previewJsonData.length > 0 ? (
                  <DynamicReport
                    jsonData={previewJsonData}
                    metadata={previewMetadata}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 border border-slate-100">
                      <FileText size={20} className="text-slate-300" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">No preview data yet</p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Generate the template once in the configurator to populate this preview.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAutoGeneratingCharts && (
        <div className="absolute inset-0 z-30 bg-slate-950/8 backdrop-blur-[2px] flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 shadow-2xl p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Generating starter charts
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Reviewing the template preview and creating an initial chart dashboard for you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartBuilderPageContent() {
  const params = useParams();
  const { addToast } = useToast();
  const { setBackHref, setBreadcrumbs } = useHeader();

  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  const [pageData, setPageData] = useState<ChartBuilderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const augmentedSchemas = useMemo(() => {
    if (!pageData?.schemas) return [];
    
    return pageData.schemas.map(schema => {
      if (schema.chart_type === 'insight' && !schema.insight_date_range && pageData.report_template_config_json?.date_range_fields) {
        // Fallback reconstruction
        let reportStart: string | undefined;
        let reportEnd: string | undefined;
        let rangeFieldLabel: string | undefined;

        const dateRanges = pageData.report_template_config_json.date_range_fields as Record<string, Record<string, string>>;
        for (const [table, tableFields] of Object.entries(dateRanges)) {
          for (const [field, rangeStr] of Object.entries(tableFields)) {
            const parts = rangeStr.split("...");
            if (parts.length === 2) {
              const startD = new Date(parts[0]);
              const endD = new Date(parts[1]);
              if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                reportStart = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
                reportEnd = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
                
                let label = `${table}::${field}`;
                if (pageData.report_template_setup_json?.tables) {
                  const tables = pageData.report_template_setup_json.tables as any;
                  if (tables[table]?.fields?.[field]?.label) {
                    label = tables[table].fields[field].label;
                  }
                }
                rangeFieldLabel = label;
                break;
              }
            }
          }
          if (reportStart) break;
        }

        if (reportStart && reportEnd && rangeFieldLabel) {
          return {
            ...schema,
            insight_date_range: {
              field: rangeFieldLabel,
              start: reportStart,
              end: reportEnd,
            }
          };
        }
      }
      return schema;
    });
  }, [pageData]);
  
  const insightContext = useMemo(() => {
    if (!pageData?.report_template_config_json?.date_range_fields) return undefined;
    const dateRanges = pageData.report_template_config_json.date_range_fields as Record<string, Record<string, string>>;
    const setupTables = (pageData.report_template_setup_json?.tables ?? null) as
      | Record<string, { fields?: Record<string, { label?: string }> }>
      | null;

    for (const [tableName, tableFields] of Object.entries(dateRanges)) {
      for (const [fieldName, rangeStr] of Object.entries(tableFields)) {
        const parts = rangeStr.split("...");
        if (parts.length === 2) {
          const startD = new Date(parts[0]);
          const endD = new Date(parts[1]);
          if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
            const fieldLabel =
              setupTables?.[tableName]?.fields?.[fieldName]?.label
              ?? fieldName;
            return {
              reportStart: `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`,
              reportEnd: `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`,
              reportDateField: fieldLabel,
            };
          }
        }
      }
    }
    return undefined;
  }, [pageData]);

  const fieldSchemas = useMemo(() => {
    if (!pageData) return [];
    return deriveFieldSchemas(
      pageData.report_template_config_json,
      pageData.report_template_setup_json
    );
  }, [pageData]);

  useEffect(() => {
    if (!templateId || !slug) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: ChartBuilderResponse }>(
          `/api/report-templates/${templateId}/charts`
        );

        if (!res.success || !res.data) {
          throw new Error("Failed to load chart builder");
        }

        setPageData(res.data);
        if (res.data.rows.length === 0) {
          addToast(
            "warning",
            "No Preview Data",
            "The template has no preview dataset yet. Update the configurator first for realistic chart previews."
          );
        }
      } catch (error: unknown) {
        addToast(
          "error",
          "Load Error",
          error instanceof Error
            ? error.message
            : "Failed to load chart builder."
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [addToast, slug, templateId]);

  useEffect(() => {
    if (!slug || !templateId) return;
    setBreadcrumbs([
      { label: "Report Templates", href: `/${slug}/templates` },
      { label: "Setup", href: `/${slug}/templates/${templateId}/setup` },
      { label: "Report Builder", href: `/${slug}/templates/${templateId}/configurator` },
      { label: "Chart Builder" },
    ]);
    setBackHref(`/${slug}/templates/${templateId}/configurator`);
  }, [slug, templateId, setBreadcrumbs, setBackHref]);

  if (isLoading || !pageData) {
    return <LoadingSkeleton />;
  }

  return (
    <DashboardProvider
      initialSchemas={augmentedSchemas}
      initialDataset={pageData.rows}
      initialCanvasState={pageData.canvasState}
      initialLayoutMode={pageData.layoutMode}
      templateId={templateId}
      context={insightContext}
      fieldSchemas={fieldSchemas}
    >
      <ChartBuilderWorkspace
        templateId={templateId}
        templateName={pageData.template_name}
        fieldNames={pageData.fieldNames}
        reportInsight={pageData.report_insight}
        initialConversationId={pageData.chart_conversation_id}
        initialInsightConversationId={pageData.insight_conversation_id}
        initialInsightResults={pageData.insight_results}
        configJson={pageData.report_template_config_json}
        setupJson={pageData.report_template_setup_json}
        rows={pageData.rows}
        reportDataJson={pageData.report_template_data_json}
        shouldBootstrapCharts={
          shouldBootstrapStarterCharts({
            schemaCount: pageData.schemas.length,
            conversationId: pageData.chart_conversation_id,
          })
        }
      />
    </DashboardProvider>
  );
}

export default function ChartBuilderPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ChartBuilderPageContent />
    </Suspense>
  );
}

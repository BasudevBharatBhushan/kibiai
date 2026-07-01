"use client";

import { useEffect, useLayoutEffect, Suspense, useState, useCallback, useMemo, startTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ReportProvider, useReport } from "@/context/ReportContext";
import "@/styles/reportConfig.css";
import { ReportConfigurator } from "@/components/ReportConfigurator";
import { ReportPreview } from "@/components/ReportPreview";
import {
  BarChart3,
  Filter,
  SlidersHorizontal,
  PanelLeft,
  PanelRight,
  Loader2,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useHeader } from "@/context/HeaderContext";
import { ModularChatbot } from "@/components/chat/ModularChatbot";
import { REPORTS_SYSTEM_INSTRUCTION } from "@/constants/reportsSystemInstruction";
import { SQL_REPORTS_SYSTEM_INSTRUCTION } from "@/constants/sqlReportsSystemInstruction";
import { apiClient } from "@/utils/apiClient";
import { sanitizeReportConfig } from "@/lib/utils/sanitizeReportConfig";
import { SqlExecutionFloater, type SqlStep } from "@/components/SqlExecutionFloater";
import type { ClassicViewSettings } from "@/components/report-builder/ClassicViewSettingsSection";
import type { FilterField } from "@/components/report-builder/ClassicViewSettingsSection";

// ── Build predefinedPrompt (DB schema context) ─────────────────────────────────
// Per REPORTS_SYSTEM_INSTRUCTION TYPE 1/3/4:
//   predefined_prompt carries schema so user message bubble stays clean.
function hasReportConfig(config: any): boolean {
  return Boolean(
    config &&
      ((config.db_defination && config.db_defination.length > 0) ||
        Object.keys(config.group_by_fields || {}).length > 0)
  );
}

function buildSetupPrompt(setup: any, config: any): string {
  const today = new Date().toLocaleDateString("en-US");

  let setupStr = "{}";
  try { setupStr = JSON.stringify(setup || {}).replace(/"/g, "'"); } catch {}

  const suffix = hasReportConfig(config) ? "" : " Suggest me prompt related to it.";
  return `Today's date (reference for date ranges): ${today}. Here is my DB Schema - ${setupStr}.${suffix}`;
}

function buildConfigPrompt(config: any): string {
  if (!hasReportConfig(config)) return "";

  let configStr = "{}";
  try { configStr = JSON.stringify(config || {}).replace(/"/g, "'"); } catch {}
  return `Here is my Previous Report Config - ${configStr}.`;
}

// ── Panel toggle buttons — injected into the global Header via HeaderContext ───
function PanelToggles({
  isChatOpen,
  isConfigOpen,
  onToggleChat,
  onToggleConfig,
}: {
  isChatOpen: boolean;
  isConfigOpen: boolean;
  onToggleChat: () => void;
  onToggleConfig: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
      <button
        onClick={onToggleChat}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all text-[11px] font-semibold ${
          isChatOpen
            ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
            : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
        }`}
        title="Toggle AI Copilot"
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
        title="Toggle Report Configurator"
        aria-pressed={isConfigOpen}
      >
        <PanelRight size={14} strokeWidth={isConfigOpen ? 2 : 1.5} />
        <span className="hidden sm:inline">Configure</span>
      </button>
    </div>
  );
}

// ── Inner Component (needs ReportProvider) ────────────────────────────────────
function ConfiguratorPageContent({
  templateId,
  slug,
}: {
  templateId: string;
  slug: string;
}) {
  const { state, dispatch } = useReport();
  const { addToast } = useToast();
  const { setBreadcrumbs, setBackHref, setHeaderActions, setSubtitle, resetHeader } = useHeader();
  const router = useRouter();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [hasPreviewData, setHasPreviewData] = useState(false);
  const [sqlFloaterStep, setSqlFloaterStep] = useState<SqlStep | null>(null);
  const [isSqlFetching, setIsSqlFetching] = useState(false);

  // Classic view display settings — shared between preview and configurator panels
  const [classicSettings, setClassicSettings] = useState<ClassicViewSettings>({
    showAvg: false,
    collapseBody: false,
    paginate: false,
  });

  // Sync from DB config when loaded
  useEffect(() => {
    if (state.config?.classic_settings) {
      setClassicSettings((prev) => ({
        ...prev,
        ...state.config.classic_settings,
      }));
    }
  }, [state.config?.classic_settings]);

  const handleClassicSettingsChange = useCallback(
    (key: keyof ClassicViewSettings, value: boolean) => {
      const next = { ...classicSettings, [key]: value };
      setClassicSettings(next);
      if (state.templateId) {
        dispatch({ type: "UPDATE_CLASSIC_SETTINGS", payload: { [key]: value } });
        const newConfig = { ...state.config, classic_settings: next };
        apiClient.post(`/api/templates/${state.templateId}/config`, { config_json: newConfig }).catch(console.error);
      }
    },
    [classicSettings, state.templateId, state.config, dispatch]
  );

  // View mode — classic (default) or print — shared between preview and configurator
  const [viewMode, setViewMode] = useState<"classic" | "print">("classic");
  const handleViewModeChange = useCallback((mode: "classic" | "print") => {
    setViewMode(mode);
  }, []);

  // Quick filters — computed from live report data, controlled here and passed to both panels
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const handleFilterChange = useCallback((field: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
  }, []);

  const filterFields = useMemo<FilterField[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = state.reportPreview;
    if (!raw) return [];
    let jsonData: unknown[] = [];
    try {
      if (raw.report_structure_json && Array.isArray(raw.report_structure_json)) {
        jsonData = raw.report_structure_json;
      } else if (Array.isArray(raw)) {
        jsonData = raw;
      } else if (raw.ReportStructuredData) {
        const p = typeof raw.ReportStructuredData === "string"
          ? JSON.parse(raw.ReportStructuredData) : raw.ReportStructuredData;
        jsonData = Array.isArray(p) ? p : [];
      }
    } catch { jsonData = []; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyData: Record<string, unknown>[] = (jsonData.find((x: any) => "Body" in x) as any)?.Body?.BodyField ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subsummaries: any[] = jsonData.filter((x: any) => "Subsummary" in x).map((x: any) => x.Subsummary);

    const seen = new Set<string>();
    const result: FilterField[] = [];
    for (const ss of subsummaries) {
      const field: string = ss.SubsummaryFields?.[0];
      if (!field || seen.has(field)) continue;
      seen.add(field);
      const options = [
        ...new Set(bodyData.map((r) => String(r[field] ?? "").trim()).filter(Boolean)),
      ].sort();
      if (options.length > 0) result.push({ field, options });
    }
    return result;
  }, [state.reportPreview]);

  const dateFields = useMemo<string[]>(() => {
    const raw: any = state.reportPreview;
    if (!raw) return [];
    let jsonData: unknown[] = [];
    try {
      if (raw.report_structure_json && Array.isArray(raw.report_structure_json)) {
        jsonData = raw.report_structure_json;
      } else if (Array.isArray(raw)) {
        jsonData = raw;
      } else if (raw.ReportStructuredData) {
        const p = typeof raw.ReportStructuredData === "string"
          ? JSON.parse(raw.ReportStructuredData) : raw.ReportStructuredData;
        jsonData = Array.isArray(p) ? p : [];
      }
    } catch { return []; }

    const bodyData: Record<string, unknown>[] = (jsonData.find((x: any) => "Body" in x) as any)?.Body?.BodyField ?? [];
    if (!bodyData.length) return [];
    
    // Pick the first row with values to test for date types
    const sample = bodyData[0];
    return Object.keys(sample).filter(k => {
      const v = sample[k];
      if (typeof v === "string" && v.length > 5 && isNaN(Number(v))) {
        const ts = Date.parse(v);
        return !isNaN(ts);
      }
      return false;
    }).sort();
  }, [state.reportPreview]);

  const toggleChat = useCallback(() => setIsChatOpen((p) => !p), []);
  const toggleConfig = useCallback(() => setIsConfigOpen((p) => !p), []);

  // ── Inject panel toggles into the global header ───────────────────────────
  // Update header actions whenever toggle state changes (so button appearance stays in sync)
  // but ONLY call resetHeader on true unmount — not on every re-render.
  useLayoutEffect(() => {
    setHeaderActions(
      <PanelToggles
        isChatOpen={isChatOpen}
        isConfigOpen={isConfigOpen}
        onToggleChat={toggleChat}
        onToggleConfig={toggleConfig}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatOpen, isConfigOpen]);

  // Separate unmount-only cleanup so breadcrumbs are NOT wiped on every toggle
  useLayoutEffect(() => {
    return () => {
      setHeaderActions(null);
      setSubtitle(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load config from Supabase ────────────────────────────────────────────────
  useEffect(() => {
    if (!templateId) return;

    const load = async () => {
      setIsPageLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: any }>(
          `/api/templates/${templateId}/config`
        );

        if (!res.success || !res.data) throw new Error("Failed to load template configuration");

        const { data } = res;
        setTemplateName(data.template_name || "Configurator");
        setSubtitle(data.template_name || null);

        if (!data.has_setup) {
          addToast("warning", "Setup Required", "Please complete the Setup Wizard first.");
          router.push(`/${slug}/templates/${templateId}/setup`);
          return;
        }

        // Sanitize config before loading into context (removes field overlaps etc.)
        const rawConfig = data.config_json || {
          report_header: "",
          response_to_user: "",
          db_defination: [],
          report_columns: [],
          group_by_fields: {},
          filters: {},
          date_range_fields: {},
          body_sort_order: [],
          summary_fields: [],
          custom_calculated_fields: [],
        };
        const cleanConfig = sanitizeReportConfig(rawConfig);

        dispatch({
          type: "LOAD_FULL_REPORT",
          payload: {
            config: cleanConfig,
            setup: data.setup_json,
            templateId: data.template_id,
            conversationId: data.conversation_id ?? null,
          },
        });

        // Check if this is a SQL-based report
        const isSqlReport = data.setup_json?.data_source_type === "sql";

        setBreadcrumbs([
          { label: "Report Templates", href: `/${slug}/templates` },
          { label: "Setup", href: `/${slug}/templates/${templateId}/setup` },
          { label: "Report Builder" },
          ...(slug !== "equiparts" && !isSqlReport ? [{ label: "Chart Builder", href: `/${slug}/templates/${templateId}/charts` }] : []),
        ]);
        setBackHref(`/${slug}/templates`);

        // Load existing preview directly from report_template_data_json when available.
        if (data.preview_data_json) {
          setHasPreviewData(true);
          const pvd = data.preview_data_json as Record<string, unknown>;
          // Check if it's the new wrapped format with report_structure_json
          if (pvd.report_structure_json) {
            // Reconstruct the SQL wrapper payload if nested_report was saved alongside
            const previewPayload = pvd.nested_report
              ? { report_structure_json: pvd.report_structure_json, nested_report: pvd.nested_report }
              : pvd.report_structure_json;
            const isGrouped =
              pvd.nested_report &&
              Array.isArray((pvd.nested_report as Record<string, unknown>).groups) &&
              ((pvd.nested_report as Record<string, unknown>).groups as unknown[]).length > 0;
            // Use startTransition so rendering hundreds of group rows doesn't block the UI.
            startTransition(() => {
              dispatch({ type: "SET_REPORT_PREVIEW", payload: previewPayload });
              if (pvd.stitch_result) {
                dispatch({ type: "SET_STITCH_RESULT", payload: pvd.stitch_result });
              }
              if (isGrouped) {
                setClassicSettings((prev) => ({ ...prev, collapseBody: true }));
                dispatch({ type: "UPDATE_CLASSIC_SETTINGS", payload: { collapseBody: true } });
              }
            });
          } else {
            startTransition(() => {
              dispatch({ type: "SET_REPORT_PREVIEW", payload: data.preview_data_json });
            });
          }
        } else if (data.config_json && data.setup_json) {
          setHasPreviewData(false);
          // Do not auto-generate report preview on mount
        }
      } catch (err: any) {
        addToast("error", "Load Error", err.message || "Failed to load configurator.");
      } finally {
        setIsPageLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const fetchLivePreview = useCallback(async (configOverride?: any, confirmLarge = false) => {
    if (!templateId) return;

    dispatch({ type: "SET_PROCESSING_LOGS", payload: [] });
    dispatch({ type: "SET_LOADING", payload: true });
    setSqlFloaterStep(null);
    setIsSqlFetching(true);

    try {
      const response = await fetch(`/api/templates/${templateId}/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persist_to_template: true,
          ...(configOverride ? { config_json: configOverride } : {}),
          ...(confirmLarge ? { confirm_large: true } : {}),
        }),
      });

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const logs: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;
          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "log") {
            logs.push(event.message as string);
            dispatch({ type: "SET_PROCESSING_LOGS", payload: [...logs] });
          } else if (event.type === "sql_step") {
            setSqlFloaterStep({ label: event.label as string, sql: event.sql as string });
          } else if (event.type === "done") {
            const structured = event.report_structure_json;
            if (structured) {
              setHasPreviewData(true);
              const isGrouped =
                event.nested_report &&
                event.nested_report.groups &&
                event.nested_report.groups.length > 0;
              // Use startTransition so rendering hundreds of group rows doesn't block the UI.
              startTransition(() => {
                if (event.nested_report) {
                  dispatch({
                    type: "SET_REPORT_PREVIEW",
                    payload: {
                      report_structure_json: structured,
                      nested_report: event.nested_report,
                    },
                  });
                  if (isGrouped) {
                    setClassicSettings((prev) => ({ ...prev, collapseBody: true }));
                    dispatch({ type: "UPDATE_CLASSIC_SETTINGS", payload: { collapseBody: true } });
                  }
                } else {
                  dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });
                }
                if (event.stitch_result) {
                  dispatch({ type: "SET_STITCH_RESULT", payload: event.stitch_result });
                }
              });
            }
          } else if (event.type === "warn_large") {
            reader.cancel();
            dispatch({ type: "SET_LOADING", payload: false });
            const rowCount: number = event.row_count ?? 0;
            const confirmed = window.confirm(
              `This report would return ${rowCount.toLocaleString()} rows which exceeds the 30,000-row preview limit.\n\nDo you want to load all rows anyway? This may take longer.`
            );
            if (confirmed) {
              await fetchLivePreview(configOverride, true);
            }
            return;
          } else if (event.type === "error") {
            throw new Error(event.message || "Report generation failed.");
          }
        }
      }
    } catch (e: any) {
      console.error("Preview generation failed", e);
      addToast("error", "Generation Failed", e.message || "Failed to generate report preview.");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
      setIsSqlFetching(false);
    }
  }, [dispatch, templateId, addToast]);

  // ── AI response handler ───────────────────────────────────────────────────────
  const handleAssistantResponse = useCallback(
    async (parsedResponse: string, rawResponseText: string) => {
      let jsonString = rawResponseText || parsedResponse;
      const jsonMatch = jsonString.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) jsonString = jsonMatch[1];
      else {
        const matchPlain = jsonString.match(/(\{[\s\S]*\})/);
        if (matchPlain) jsonString = matchPlain[1];
      }
      try {
        const parsedJson = JSON.parse(jsonString);
        if (parsedJson.db_defination || parsedJson.report_columns) {
          // Build a safe merged config from the AI response
          const rawConfig = {
            ...state.config,
            report_header: parsedJson.report_header || state.config.report_header || "",
            response_to_user: parsedJson.response_to_user || state.config.response_to_user || "",
            db_defination: parsedJson.db_defination || state.config.db_defination || [],
            report_columns: parsedJson.report_columns || state.config.report_columns || [],
            group_by_fields: parsedJson.group_by_fields || state.config.group_by_fields || {},
            filters: parsedJson.filters || state.config.filters || {},
            date_range_fields: parsedJson.date_range_fields || state.config.date_range_fields || {},
            body_sort_order: parsedJson.body_sort_order || state.config.body_sort_order || [],
            summary_fields: parsedJson.summary_fields || state.config.summary_fields || [],
            custom_calculated_fields:
              parsedJson.custom_calculated_fields || state.config.custom_calculated_fields || [],
          };

          // Sanitize: remove field overlaps, deduplicate sections
          const safeConfig = sanitizeReportConfig(rawConfig);

          if (state.templateId) {
            // Save sanitized config (not raw AI output) to DB
            await apiClient.post(`/api/templates/${state.templateId}/config`, { config_json: safeConfig });
          }

          dispatch({ type: "LOAD_INITIAL_CONFIG", payload: safeConfig });
          await fetchLivePreview(safeConfig);
        }
      } catch {
        // Gracefully ignore suggestion-only / non-JSON responses
      }
    },
    [state.templateId, state.config, dispatch, fetchLivePreview]
  );

  // ── Conversation ID sync ──────────────────────────────────────────────────────
  const handleConversationIdChange = useCallback(
    async (id: string | null) => {
      dispatch({ type: "SET_CONVERSATION_ID", payload: id });
      if (id && state.templateId) {
        apiClient
          .post(`/api/templates/${state.templateId}/config`, { conversation_id: id })
          .catch((e) => console.error("Failed to sync conversation ID", e));
      }
    },
    [state.templateId, dispatch]
  );

  // ── predefinedPrompt — DB schema context (invisible to user bubble) ────────
  // Intentionally NOT including state.config here — only structural fields that
  // actually change the DB schema context should trigger a chatbot re-init.
  // Cosmetic edits (labels, sort order, grouping) should not rebuild this.
  const setupPrompt = useMemo(
    () => buildSetupPrompt(state.setup, state.config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.setup, state.config.db_defination, state.config.report_columns]
  );

  const configPrompt = useMemo(
    () => buildConfigPrompt(state.config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.config.db_defination, state.config.report_columns, state.config.filters]
  );

  // ── formatPrompt — just adds .json (user bubble stays clean) ─────────────
  const formatPrompt = useCallback((userText: string) => {
    const trimmed = userText.trim();
    return trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;
  }, []);

  const reportPromptOptions = useMemo(
    () => [
      {
        title: "Executive Summary",
        description: "Create a report with totals, month-wise trend, and top-performing segments for leadership review.",
        icon: <BarChart3 className="h-5 w-5 text-indigo-500" />,
      },
      {
        title: "Segment Filters",
        description: "Build a report with flexible filters for date range, region, owner, and status.",
        icon: <Filter className="h-5 w-5 text-indigo-500" />,
      },
      {
        title: "Configurable Layout",
        description: "Set up grouped sections, summary rows, and ordered columns for a clean operational report.",
        icon: <SlidersHorizontal className="h-5 w-5 text-indigo-500" />,
      },
    ],
    []
  );

  return (
    // No extra header here — panel toggles live in the global Header via HeaderContext
    <div className="flex flex-1 overflow-hidden relative">
      <SqlExecutionFloater currentStep={sqlFloaterStep} isGenerating={isSqlFetching} />

      {/* COLUMN 1: AI Copilot (Left) — has its own skeleton; independent of preview calc */}
      <div
        className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 ${
          isChatOpen
            ? isConfigOpen
              ? "w-[400px]"
              : "w-[600px] flex-1 max-w-[50%]"
            : "w-0 border-none overflow-hidden"
        }`}
      >
        <div className="flex-1 overflow-hidden flex flex-col min-w-[400px]">
          {!state.setup ? (
            /* Chat skeleton — shown while config API is in flight */
            <div className="flex flex-col h-full p-4 space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="flex-1 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-12 rounded-xl ${i % 2 === 0 ? "bg-slate-100 ml-8" : "bg-blue-50 mr-8"}`} />
                ))}
              </div>
              <div className="h-10 bg-slate-100 rounded-xl" />
            </div>
          ) : (
            <ModularChatbot
              botName="Reports"
              autoInitialize={!hasPreviewData && !!state.setup}
              showAiSuggestions={true}
              showSetupCheckbox={true}
              instructionSet={
                (state.setup as unknown as Record<string, unknown>)?.data_source_type === "sql"
                  ? SQL_REPORTS_SYSTEM_INSTRUCTION
                  : REPORTS_SYSTEM_INSTRUCTION
              }
              setupPrompt={setupPrompt}
              configPrompt={configPrompt}
              formatPrompt={formatPrompt}
              suggestedPrompts={reportPromptOptions}
              initialConversationId={state.conversationId}
              onAssistantResponse={handleAssistantResponse}
              onConversationIdChange={handleConversationIdChange}
              className="h-full w-full flex flex-col bg-white overflow-hidden relative"
              welcomeMessage="Hello! I am your KiBiAI Assistant. I can help you generate ERP reports from your data. What would you like to see?"
            />
          )}
        </div>
      </div>

      {/* COLUMN 2: Live Preview (Middle) */}
      <div
        className={`bg-gray-100 p-4 overflow-auto scrollbar-minimal flex justify-center items-start transition-all duration-300 relative ${
          !isChatOpen && !isConfigOpen ? "flex-1" : "flex-1 min-w-[600px]"
        }`}
      >
        {isPageLoading ? (
          <div className="w-full animate-pulse">
            <div className="bg-white shadow-xl rounded w-full max-w-[210mm] mx-auto min-h-[400px] p-8 space-y-4">
              <div className="flex justify-between mb-6">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-7 w-48 bg-slate-100 rounded" />
              </div>
              <div className="h-px bg-slate-100" />
              {[...Array(14)].map((_, i) => (
                <div key={i} className="h-3 bg-slate-50 rounded" style={{ width: `${95 - (i % 3) * 10}%` }} />
              ))}
            </div>
          </div>
        ) : (
        /* Report preview is ALWAYS mounted — loading indicator overlays on top */
        <div className="w-full max-w-full flex justify-center">
          <ReportPreview
            classicSettings={classicSettings}
            viewMode={viewMode}
            activeFilters={activeFilters}
          />
        </div>
        )}

        {/* SSE loading overlay — floats above the existing report, never replaces it */}
        {state.isLoading && (
          <div className="absolute inset-0 z-20 flex justify-center items-start pt-8 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md mx-4">
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="relative flex h-6 w-6 items-center justify-center shrink-0">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-20" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-900 flex-1">Generating Preview…</p>
                  <span className="text-[11px] text-slate-500 tabular-nums font-bold bg-slate-100/50 px-2 py-0.5 rounded-full border border-slate-200/50">
                    {state.processingLogs.length} steps
                  </span>
                </div>
                <div
                  className="overflow-y-auto px-4 py-2 space-y-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  style={{ maxHeight: "220px" }}
                  ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                >
                  {state.processingLogs.length === 0 ? (
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      <p className="text-[11px] text-slate-400 italic">Initialising engine…</p>
                    </div>
                  ) : (
                    state.processingLogs.map((line, i) => {
                      const isSuccess = line.startsWith("✅");
                      const isWarning = line.toLowerCase().includes("warning") || line.startsWith("⚠");
                      const isError = line.startsWith("❌");
                      const isLast = i === state.processingLogs.length - 1;
                      return (
                        <div key={i} className="flex items-start gap-2 animate-in fade-in duration-150">
                          <div className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${
                            isSuccess ? "bg-emerald-500" : isWarning ? "bg-amber-400" :
                            isError ? "bg-red-500" : isLast ? "bg-blue-500 animate-pulse" : "bg-slate-300"
                          }`} />
                          <span className={`text-[12px] leading-relaxed ${
                            isSuccess ? "text-emerald-800 font-semibold" : isWarning ? "text-amber-800" :
                            isError ? "text-red-800 font-semibold" : isLast ? "text-slate-900 font-bold" : "text-slate-700"
                          }`}>
                            {line.replace(/^[✅❌⚠️]\s*/, "")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="h-1 bg-slate-100">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                    style={{ width: state.processingLogs.length === 0 ? "5%" : `${Math.min(95, (state.processingLogs.length / 15) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* COLUMN 3: Report Configurator (Right) — has its own skeleton; independent of preview calc */}
      <div
        className={`bg-white border-l border-slate-200 h-full shadow-xl z-10 transition-[width] duration-300 ease-in-out flex flex-col shrink-0 ${
          isConfigOpen
            ? isChatOpen
              ? "w-[400px]"
              : "w-[600px] flex-1 max-w-[50%]"
            : "w-0 border-none overflow-hidden"
        }`}
      >
        <div className="flex-1 overflow-hidden relative flex flex-col min-w-[400px]">
          {!state.setup ? (
            /* Configurator skeleton — shown while config API is in flight */
            <div className="p-4 space-y-4 animate-pulse">
              <div className="h-px bg-slate-100" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="h-10 bg-slate-50" />
                  <div className="p-3 space-y-2">
                    <div className="h-8 bg-slate-100 rounded-lg" />
                    <div className="h-8 bg-slate-100 rounded-lg" />
                  </div>
                </div>
              ))}
              <div className="h-10 bg-blue-50 rounded-xl" />
            </div>
          ) : (
            <ReportConfigurator
              classicSettings={classicSettings}
              onClassicSettingsChange={handleClassicSettingsChange}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              filterFields={filterFields}
              dateFields={dateFields}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page Route Component ──────────────────────────────────────────────────────────────────
export default function ConfiguratorPage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  return (
    // -mx escape lets the full-bleed flex layout break out of PageContainer horizontal padding
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans">
      <Suspense fallback={
        <div className="flex flex-1 overflow-hidden animate-pulse">
          <div className="w-[400px] shrink-0 bg-white border-r border-slate-100" />
          <div className="flex-1 bg-gray-100" />
          <div className="w-[400px] shrink-0 bg-white border-l border-slate-100" />
        </div>
      }>
        <ReportProvider>
          <ConfiguratorPageContent templateId={templateId} slug={slug} />
        </ReportProvider>
      </Suspense>
    </div>
  );
}

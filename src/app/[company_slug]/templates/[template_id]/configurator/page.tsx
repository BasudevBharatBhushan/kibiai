"use client";

import { useEffect, useLayoutEffect, Suspense, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useHeader } from "@/context/HeaderContext";
import { ModularChatbot } from "@/components/chat/ModularChatbot";
import { REPORTS_SYSTEM_INSTRUCTION } from "@/constants/reportsSystemInstruction";
import { apiClient } from "@/utils/apiClient";

// ── Build predefinedPrompt (DB schema context) ─────────────────────────────────
// Per REPORTS_SYSTEM_INSTRUCTION TYPE 1/3/4:
//   predefined_prompt carries schema so user message bubble stays clean.
function buildPredefinedPrompt(setup: any, config: any): string {
  const today = new Date().toLocaleDateString("en-US");

  let setupStr = "{}";
  try { setupStr = JSON.stringify(setup || {}).replace(/"/g, "'"); } catch {}

  const hasConfig =
    config &&
    ((config.db_defination && config.db_defination.length > 0) ||
      Object.keys(config.group_by_fields || {}).length > 0);

  if (hasConfig) {
    let configStr = "{}";
    try { configStr = JSON.stringify(config || {}).replace(/"/g, "'"); } catch {}
    return `Today's date (reference for date ranges): ${today}. Here is my DB Schema - ${setupStr}. Here is my Previous Report Config - ${configStr}.`;
  }

  return `Today's date (reference for date ranges): ${today}. Here is my DB Schema - ${setupStr}.`;
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
  const { setBreadcrumbs, setBackHref, setHeaderActions, resetHeader } = useHeader();
  const router = useRouter();

  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");

  const toggleChat = useCallback(() => setIsChatOpen((p) => !p), []);
  const toggleConfig = useCallback(() => setIsConfigOpen((p) => !p), []);

  // ── Inject panel toggles into the global header ───────────────────────────
  // useLayoutEffect ensures the header is updated synchronously before paint,
  // and cleanup removes them when navigating away.
  useLayoutEffect(() => {
    setHeaderActions(
      <PanelToggles
        isChatOpen={isChatOpen}
        isConfigOpen={isConfigOpen}
        onToggleChat={toggleChat}
        onToggleConfig={toggleConfig}
      />
    );
    return () => resetHeader();
    // Re-run whenever toggle state changes so button appearance stays in sync
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isChatOpen, isConfigOpen]);

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

        if (!data.has_setup) {
          addToast("warning", "Setup Required", "Please complete the Setup Wizard first.");
          router.push(`/${slug}/templates/${templateId}/setup`);
          return;
        }

        dispatch({
          type: "LOAD_FULL_REPORT",
          payload: {
            config: data.config_json || {
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
            },
            setup: data.setup_json,
            templateId: data.template_id,
            conversationId: data.conversation_id ?? null,
          },
        });

        setBreadcrumbs([
          { label: "Templates", href: `/${slug}/templates` },
          { label: data.template_name || templateId, href: `/${slug}/templates/${templateId}/setup` },
          { label: "Configurator" },
        ]);
        setBackHref(`/${slug}/templates`);

        if (data.config_json && data.preview_data_json) {
          dispatch({ type: "SET_REPORT_PREVIEW", payload: data.preview_data_json });
        } else if (data.config_json && data.setup_json) {
          fetchLivePreview(data.setup_json, data.config_json);
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

  // ── Live preview ─────────────────────────────────────────────────────────────
  const fetchLivePreview = useCallback(
    async (setupData: any, configData: any) => {
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const result = await apiClient.post<{ status: string; report_structure_json: any }>(
          "/api/generate-report",
          { report_setup: setupData, report_config: configData }
        );
        if (result.status === "ok" && result.report_structure_json) {
          dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });
        }
      } catch (e) {
        console.error("Preview generation failed", e);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [dispatch]
  );

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
          const safeConfig = {
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

          if (state.templateId) {
            apiClient
              .post(`/api/templates/${state.templateId}/config`, { config_json: parsedJson })
              .catch((e) => console.error("Failed to save AI config:", e));
          }

          dispatch({ type: "LOAD_INITIAL_CONFIG", payload: safeConfig });
          await fetchLivePreview(state.setup, safeConfig);
        }
      } catch (e) {
        // Gracefully ignore suggestion-only / non-JSON responses
      }
    },
    [state.templateId, state.setup, state.config, dispatch, fetchLivePreview]
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
  const predefinedPrompt = useMemo(
    () => buildPredefinedPrompt(state.setup, state.config),
    [state.setup, state.config]
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

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (isPageLoading) {
    return (
      <div className="flex flex-1 overflow-hidden animate-pulse">
        <div className="w-[400px] bg-white border-r border-slate-100" />
        <div className="flex-1 bg-gray-100" />
        <div className="w-[400px] bg-white border-l border-slate-100" />
      </div>
    );
  }

  return (
    // No extra header here — panel toggles live in the global Header via HeaderContext
    <div className="flex flex-1 overflow-hidden relative">

      {/* COLUMN 1: AI Copilot (Left) */}
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
          <ModularChatbot
            botName="Kibiai Report Assistant"
            instructionSet={REPORTS_SYSTEM_INSTRUCTION}
            predefinedPrompt={predefinedPrompt}
            formatPrompt={formatPrompt}
            suggestedPrompts={reportPromptOptions}
            initialConversationId={state.conversationId}
            onAssistantResponse={handleAssistantResponse}
            onConversationIdChange={handleConversationIdChange}
            className="h-full w-full flex flex-col bg-white overflow-hidden relative"
            welcomeMessage="Hello! I am your KiBiAI Assistant. I can help you generate ERP reports from your data. What would you like to see?"
          />
        </div>
      </div>

      {/* COLUMN 2: Live Preview (Middle) */}
      <div
        className={`bg-gray-100 p-4 overflow-auto flex justify-center items-start transition-all duration-300 relative ${
          !isChatOpen && !isConfigOpen ? "flex-1" : "flex-1 min-w-[600px]"
        }`}
      >
        {state.isLoading ? (
          <div className="w-full h-full flex justify-center py-8">
            <div className="w-full max-w-[210mm] aspect-[1/1.414] bg-white shadow-sm rounded-sm p-12 space-y-8 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-6 w-32 bg-slate-100 rounded" />
                <div className="h-10 w-48 bg-slate-100 rounded" />
              </div>
              <div className="space-y-4">
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
              </div>
              <div className="border-t border-slate-100 pt-8 space-y-4">
                <div className="h-32 w-full bg-slate-50 rounded" />
                <div className="h-32 w-full bg-slate-50 rounded" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full transition-all duration-300 max-w-full flex justify-center">
            <ReportPreview />
          </div>
        )}
      </div>

      {/* COLUMN 3: Report Configurator (Right) — has its own Update + Generate buttons */}
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
          <ReportConfigurator />
        </div>
      </div>
    </div>
  );
}

// ── Page Route Component ───────────────────────────────────────────────────────
export default function ConfiguratorPage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const templateId = params?.template_id as string;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans">
      <Suspense fallback={
        <div className="flex flex-1 overflow-hidden animate-pulse">
          <div className="w-[400px] bg-white border-r border-slate-100" />
          <div className="flex-1 bg-gray-100" />
          <div className="w-[400px] bg-white border-l border-slate-100" />
        </div>
      }>
        <ReportProvider>
          <ConfiguratorPageContent templateId={templateId} slug={slug} />
        </ReportProvider>
      </Suspense>
    </div>
  );
}

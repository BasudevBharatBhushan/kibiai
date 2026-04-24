"use client";

import { useEffect, Suspense, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ReportProvider, useReport } from "@/context/ReportContext";
import "@/styles/reportConfig.css"; 
import { ReportConfigurator } from "@/components/ReportConfigurator";
import { ReportPreview }  from "@/components/ReportPreview";
import {
  BarChart3,
  FileText,
  Filter,
  PanelLeft,
  PanelRight,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { ModularChatbot } from "@/components/chat/ModularChatbot";
import { REPORTS_SYSTEM_INSTRUCTION } from "@/constants/reportsSystemInstruction";

function ReportPageContent() {

  // --- CONTEXT & HOOKS ---
  const { state, dispatch } = useReport();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report_id");
  const { addToast } = useToast();


  // --- COLLAPSIBLE STATE ---
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Function to fetch live preview — also persists snapshot to DB when fmRecordId is available
  const fetchLivePreview = useCallback(async (setupData: any, configData: any, fmRecordId?: string | null) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_setup: setupData, report_config: configData })
      });
      const result = await res.json();
      
      if(result.status === "ok" && result.report_structure_json) {
         dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });

         // Persist snapshot to DB so next load doesn't show stale data
         if (fmRecordId) {
           fetch("/api/report-config", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
               fmRecordId,
               reportStructuredData: result.report_structure_json
             })
           }).catch(e => console.error("Failed to persist report snapshot:", e));
         }
      }
    } catch (e) {
      console.error("Preview Generation Failed", e);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [dispatch]);

  // On mount or reportId change, load report config
  useEffect(() => {
    async function load() {
      if (!reportId) return;
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        // 1. Fetch Config from DB
        const res = await fetch(`/api/report-config?id=${reportId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Load Config into Builder
        dispatch({ type: "LOAD_FULL_REPORT", payload: data });
        if (data.threadId) setConversationId(data.threadId);

        // 2. Initial Preview Logic
        if (data.reportStructuredData) {
           // If DB has a saved preview string, parse and use it
           let parsedPreview = [];
           try {
              parsedPreview = typeof data.reportStructuredData === 'string' 
                ? JSON.parse(data.reportStructuredData) 
                : data.reportStructuredData;
           } catch(e) { console.error("JSON Parse Error", e); }
           
           dispatch({ type: "SET_REPORT_PREVIEW", payload: parsedPreview });
        } else {
           // Fallback: Generate live if no saved preview exists
           await fetchLivePreview(data.setup, data.config);
        }

      } catch (e) {
        console.error("Failed to load report configuration:", e);
        const message = e instanceof Error ? e.message : String(e);
        addToast("error", "Error", message || "Failed to load report configuration.");
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    load();
  }, [reportId, dispatch, fetchLivePreview, addToast]);

  const handleAssistantResponse = useCallback(async (parsedResponse: string, rawResponseText: string) => {
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
          custom_calculated_fields: parsedJson.custom_calculated_fields || state.config.custom_calculated_fields || []
        };

        // Save config to DB first (fire & forget)
        if (state.fmRecordId) {
          fetch("/api/report-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fmRecordId: state.fmRecordId, config: parsedJson })
          }).catch(e => console.error("Failed to save AI config:", e));
        }

        dispatch({ type: "LOAD_INITIAL_CONFIG", payload: safeConfig });
        // Pass fmRecordId so fetchLivePreview can persist the generated snapshot too
        await fetchLivePreview(state.setup, safeConfig, state.fmRecordId);
      }
    } catch(e) {}
  }, [state.fmRecordId, state.setup, state.config, dispatch, fetchLivePreview]);

  const handleConversationIdChange = useCallback(async (id: string | null) => {
    setConversationId(id);
    if (id && state.fmRecordId) {
      try {
        await fetch("/api/report-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fmRecordId: state.fmRecordId, threadId: id }),
        });
      } catch (e) {
         console.error("Failed to sync thread ID", e);
      }
    }
  }, [state.fmRecordId]);

  const formatPrompt = useCallback((userText: string) => {
    const today = new Date().toLocaleDateString('en-US');
    let setupData = "{}";
    try {
      setupData = JSON.stringify(state.setup || {}).replace(/"/g, "'");
    } catch (e) {}

    const hasConfig = state.config && (
      Object.keys(state.config.group_by_fields || {}).length > 0 || 
      (state.config.db_defination && state.config.db_defination.length > 0)
    );

    if (hasConfig) {
      let configData = "";
      try {
        configData = JSON.stringify(state.config || {}).replace(/"/g, "'");
      } catch (e) {}
      return `${userText}. Today's date (which serves as a reference point for setting the correct date range)-${today}. Here is my DB Schema - ${setupData}. Here is my Previous Report Config - ${configData}. json`;
    } else {
      return `${userText}. Today's date (which serves as a reference point for setting the correct date range)-${today}. Here is my DB Schema - ${setupData}. json`;
    }
  }, [state.setup, state.config]);

  const reportPromptOptions = useMemo(() => ([
    {
      title: "Executive Summary",
      description: "Create a report with totals, month-wise trend, and top-performing segments for leadership review.",
      icon: <BarChart3 className="h-5 w-5 text-indigo-500" />,
    },
    {
      title: "Segment Filters",
      description: "Build a report with flexible filters for date range, region, owner, and status so teams can drill in quickly.",
      icon: <Filter className="h-5 w-5 text-indigo-500" />,
    },
    {
      title: "Configurable Layout",
      description: "Set up grouped sections, summary rows, and ordered columns for a clean operational report layout.",
      icon: <SlidersHorizontal className="h-5 w-5 text-indigo-500" />,
    },
  ]), []);

  const reportTitle =
    (state.setup as any)?.reportName ||
    (state.setup as any)?.report_name ||
    "KiBiAI";
  const reportStateLabel = state.isLoading
    ? "Syncing report"
    : reportId
      ? "Saved configuration"
      : "New draft";


  // Toggle helpers
  const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);
  const toggleConfig = useCallback(() => setIsConfigOpen(prev => !prev), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">

      {/* ── PAGE HEADER ── */}
      <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur flex items-center justify-between gap-4 z-20">
        {/* Left: Title & Status */}
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tighter text-indigo-700 italic">
                KiBiAI
              </h1>
              {reportTitle !== "KiBiAI" && (
                <>
                  <span className="text-slate-300 font-light">/</span>
                  <span className="truncate text-sm font-medium text-slate-600">
                    {reportTitle}
                  </span>
                </>
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-wide ${
              state.isLoading ? "text-indigo-600" : "text-slate-500"
            }`}>
              ReportId: {reportId || "New"}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-end shrink-0 items-center gap-3">
          <div 
            id="portal-report-actions"
            className="flex-shrink-0 flex items-center justify-center"
          />
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
            <button
              onClick={toggleChat}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all ${
                isChatOpen
                  ? "bg-white text-indigo-600 shadow-sm border border-indigo-100"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
              title="Toggle AI Copilot"
              aria-pressed={isChatOpen}
            >
              <PanelLeft size={16} strokeWidth={isChatOpen ? 2 : 1.5} />
              <span className="hidden sm:inline-block text-[11px] font-semibold tracking-wide">Copilot</span>
            </button>

            <button
              onClick={toggleConfig}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all ${
                isConfigOpen
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
              title="Toggle Report Configurator"
              aria-pressed={isConfigOpen}
            >
              <PanelRight size={16} strokeWidth={isConfigOpen ? 2 : 1.5} />
              <span className="hidden sm:inline-block text-[11px] font-semibold tracking-wide">Configure</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY (the three-column panel layout) ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* --- COLUMN 1: CHAT (Left) --- */}
        <div
          className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-300 ease-in-out shrink-0 ${
            isChatOpen ? (isConfigOpen ? "w-[420px]" : "w-[600px] flex-1 max-w-[50%]") : "w-0 border-none overflow-hidden"
          }`}
        >
          <div className="flex-1 overflow-hidden flex flex-col min-w-[420px]">
            <ModularChatbot
              botName="Kibiai Report Assistant"
              instructionSet={REPORTS_SYSTEM_INSTRUCTION}
              predefinedPrompt=""
              formatPrompt={formatPrompt}
              suggestedPrompts={reportPromptOptions}
              initialConversationId={conversationId}
              onAssistantResponse={handleAssistantResponse}
              onConversationIdChange={handleConversationIdChange}
              className="h-full w-full flex flex-col bg-white overflow-hidden relative"
              welcomeMessage="Hello! I am your KiBiAI Assistant. I can help you generate ERP reports from your data. What would you like to see?"
            />
          </div>
        </div>

        {/* --- COLUMN 2: PREVIEW (Middle) --- */}
        <div className={`bg-gray-100 p-4 overflow-auto flex justify-center items-start transition-all duration-300 relative ${(!isChatOpen && !isConfigOpen) ? 'flex-1' : 'flex-1 min-w-[500px]'}`}>
          {state.isLoading ? (
            <div className="w-full h-full flex justify-center py-8">
               <div className="w-full max-w-[210mm] aspect-[1/1.414] bg-white shadow-sm rounded-sm p-12 space-y-8 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-32 bg-slate-100 rounded"></div>
                    <div className="h-10 w-48 bg-slate-100 rounded"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                    <div className="h-4 w-full bg-slate-100 rounded"></div>
                    <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
                  </div>
                  <div className="border-t border-slate-100 pt-8 space-y-4">
                    <div className="h-32 w-full bg-slate-50 rounded"></div>
                    <div className="h-32 w-full bg-slate-50 rounded"></div>
                  </div>
               </div>
            </div>
          ) : (
            <div className={`w-full transition-all duration-300 max-w-full flex justify-center`}>
              <ReportPreview />
            </div>
          )}
        </div>

        {/* --- COLUMN 3: CONFIGURATOR (Right) --- */}
        <div
          className={`bg-white border-l border-slate-200 h-full shadow-xl z-10 transition-[width] duration-300 ease-in-out flex flex-col shrink-0 ${
            isConfigOpen ? (isChatOpen ? "w-[500px]" : "w-[600px] flex-1 max-w-[50%]") : "w-0 border-none overflow-hidden"
          }`}
        >
          {/* The actual builder content */}
          <div className="flex-1 overflow-hidden relative flex flex-col min-w-[500px]">
            <ReportConfigurator />
          </div>
        </div>

      </div>
    </div>
  );
}

// Main Page Component
export default function ReportPage() {
  return (
    <Suspense fallback={<div>Loading Page...</div>}>
      
        <ReportProvider>
          <ReportPageContent />
        </ReportProvider>
      
    </Suspense>
  );
}

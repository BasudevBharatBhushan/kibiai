"use client";

import { useEffect, Suspense, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ReportProvider, useReport } from "@/context/ReportContext";
import "@/styles/reportConfig.css"; 
import { ReportConfigurator } from "@/components/ReportConfigurator";
import { ReportPreview }  from "@/components/ReportPreview";
import { ChevronLeft, ChevronRight, MessageSquare, Settings } from "lucide-react";
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

  // Function to fetch live preview
  const fetchLivePreview = useCallback(async (setupData: any, configData: any) => {
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_setup: setupData, report_config: configData })
      });
      const result = await res.json();
      
      if(result.status === "ok" && result.report_structure_json) {
         // Store just the array part
         dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });
      }
    } catch (e) {
      console.error("Preview Generation Failed", e);
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
        if (state.fmRecordId) {
           await fetch("/api/report-config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fmRecordId: state.fmRecordId, config: parsedJson })
           });
        }
        
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
        
        dispatch({ type: "LOAD_INITIAL_CONFIG", payload: safeConfig });
        await fetchLivePreview(state.setup, safeConfig);
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


  // Toggle helpers
  const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);
  const toggleConfig = useCallback(() => setIsConfigOpen(prev => !prev), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans">

      {/* ── PAGE HEADER ── */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 gap-3 z-30 shadow-sm justify-between">
        {/* Left: panel toggle + report title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleChat}
            title={isChatOpen ? "Close Copilot" : "Open Copilot"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              isChatOpen
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <MessageSquare size={15} />
            <span className="hidden sm:inline">Copilot</span>
          </button>

          <span className="text-slate-300 select-none">|</span>

          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {(state.setup as any)?.reportName || (state.setup as any)?.report_name || "Report Builder"}
            </h1>
            <p className="text-xs text-slate-400 truncate leading-tight flex items-center gap-2">
              {reportId ? `ID: ${reportId}` : "New Report"}
              {state.isLoading && <span className="text-indigo-500 animate-pulse text-[10px]">(Loading...)</span>}
            </p>
          </div>
        </div>

        {/* Center: Action toolbar placeholder (moved from DynamicReport) */}
        <div id="portal-report-actions" className="flex-1 flex justify-center items-center gap-2 min-w-0" />

        {/* Right: config toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleConfig}
            title={isConfigOpen ? "Close Configuration" : "Open Configuration"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              isConfigOpen
                ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Configure</span>
          </button>
        </div>
      </header>

      {/* ── BODY (the three-column panel layout) ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* --- COLUMN 1: CHAT (Left) --- */}
        <div
          className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
            isChatOpen ? (isConfigOpen ? "w-[420px]" : "w-[600px] flex-1 max-w-[50%]") : "w-0 border-none overflow-hidden"
          }`}
        >

          <div className="flex-1 overflow-hidden flex flex-col">
            {(!state.setup && state.isLoading) ? (
              <div className="p-4 text-sm text-slate-400 flex items-center gap-2">
                <span className="animate-pulse">●</span> Loading AI context…
              </div>
            ) : (
              <ModularChatbot
                botName="Report Copilot"
                instructionSet={REPORTS_SYSTEM_INSTRUCTION}
                predefinedPrompt=""
                formatPrompt={formatPrompt}
                initialConversationId={conversationId}
                onAssistantResponse={handleAssistantResponse}
                onConversationIdChange={handleConversationIdChange}
                className="h-full w-full flex flex-col bg-white overflow-hidden relative"
                welcomeMessage="Hello! I am the Report Copilot. I can help you generate ERP reports from your data. What would you like to see?"
              />
            )}
          </div>
        </div>

        {/* --- COLUMN 2: PREVIEW (Middle) --- */}
        <div className={`bg-gray-100 p-4 overflow-auto flex justify-center items-start transition-all duration-300 ${(!isChatOpen && !isConfigOpen) ? 'flex-1' : 'flex-1 min-w-[500px]'}`}>
          <div className={`w-full transition-all duration-300 max-w-full flex justify-center`}>
            <ReportPreview />
          </div>
        </div>

        {/* --- COLUMN 3: CONFIGURATOR (Right) --- */}
        <div
          className={`bg-white border-l border-slate-200 h-full shadow-xl z-10 transition-all duration-300 ease-in-out flex flex-col shrink-0 ${
            isConfigOpen ? (isChatOpen ? "w-[500px]" : "w-[600px] flex-1 max-w-[50%]") : "w-0 border-none overflow-hidden"
          }`}
        >

          {/* The actual builder content */}
          <div className="flex-1 overflow-hidden relative">
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
"use client";

import { useEffect, Suspense , useState} from "react";
import { useSearchParams } from "next/navigation";
import { ReportProvider, useReport } from "@/context/ReportContext";
import "../../../styles/reportConfig.css"; 
import { ReportConfigurator } from "@/components/ReportConfigurator";
import { ReportPreview }  from "@/components/ReportPreview";
import { ChevronLeft, ChevronRight, MessageSquare, Settings } from "lucide-react";
import { useToast } from "@/context/ToastContext";



function ReportPageContent() {
  const { state, dispatch } = useReport();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report_id");
  const { addToast } = useToast();


  // --- COLLAPSIBLE STATE ---
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(true);

  const fetchLivePreview = async (setupData: any, configData: any) => {
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
  };

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
  }, [reportId, dispatch]);

  
return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans relative">

      {/* --- COLUMN 1: CHAT (Left) --- */}
      <div 
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out relative ${
          isChatOpen ? "w-[320px] translate-x-0" : "w-0 -translate-x-full border-none opacity-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b font-bold text-slate-700 flex justify-between items-center">
          <span>KiBi-AI Chat</span>
          <button onClick={() => setIsChatOpen(false)} className="hover:bg-slate-100 p-1 rounded">
             <ChevronLeft size={18} />
          </button>
        </div>
        <div className="flex-1 p-4 bg-slate-50/50 text-sm text-slate-500 overflow-auto">
          {/* Chat Content Here */}
          <div className="bg-blue-50 text-blue-800 p-3 rounded mb-2">
            Generating report for ID: {reportId}...
          </div>
        </div>
      </div>

      {/* TOGGLE BUTTON: Show Chat (When closed) */}
      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)}
          className="absolute left-4 top-4 z-20 bg-white p-2 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 text-indigo-600 transition-transform hover:scale-105"
          title="Open Chat"
        >
          <MessageSquare size={20} />
        </button>
      )}


      {/* --- COLUMN 2: PREVIEW (Middle) --- */}
      {/* This flex-1 allows it to take all remaining space automatically */}
      <div className="flex-1 bg-gray-100 p-2 overflow-auto flex justify-center items-start relative transition-all duration-300">
         <div className={`w-full transition-all duration-300 ${isConfigOpen ? 'max-w-5xl' : 'max-w-[1400px]'}`}>
            <ReportPreview />
         </div>
      </div>


      {/* TOGGLE BUTTON: Show Config (When closed) */}
      {!isConfigOpen && (
        <button 
          onClick={() => setIsConfigOpen(true)}
          className="absolute right-4 top-4 z-20 bg-white p-2 rounded-full shadow-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-transform hover:scale-105"
          title="Open Configuration"
        >
          <Settings size={20} />
        </button>
      )}

      {/* --- COLUMN 3: CONFIGURATOR (Right) --- */}
      <div 
        className={`bg-white border-l border-slate-200 h-full shadow-xl z-10 transition-all duration-300 ease-in-out flex flex-col ${
          isConfigOpen ? "w-[500px] translate-x-0" : "w-0 translate-x-full border-none opacity-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2">
              <button onClick={() => setIsConfigOpen(false)} className="hover:bg-slate-200 p-1 rounded mr-2">
                <ChevronRight size={18} />
              </button>
              <h2 className="font-bold text-slate-700">Configuration</h2>
           </div>
           <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
             {state.isLoading ? "Loading..." : "Active"}
           </span>
        </div>
        
        {/* The actual builder content */}
        <div className="flex-1 overflow-hidden relative">
           <ReportConfigurator />
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
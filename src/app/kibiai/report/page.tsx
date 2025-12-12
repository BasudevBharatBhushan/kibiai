"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReportProvider, useReport } from "@/context/ReportContext";
import "../../../styles/reportConfig.css"; 
import ReportConfigurator from "@/components/ReportConfigurator";
import { ReportPreview }  from "@/components/ReportPreview";

// --- The Inner Content (Needs Context) ---
function ReportPageContent() {
  const { state, dispatch } = useReport();
  const searchParams = useSearchParams();
  const reportId = searchParams.get("report_id");



  const fetchLivePreview = async (setupData: any, configData: any) => {
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup: setupData, config: configData })
      });
      const result = await res.json();
      
      if(result.report_structure_json) {
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

        dispatch({ type: "LOAD_FULL_REPORT", payload: data });

      } catch (e) {
        console.error(e);
        alert("Error loading report");
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    load();
  }, [reportId, dispatch]);

  
  return (
    // 3-Column Grid Layout (Matches Screenshot)
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      
      {/* Column 1: Chatbot (Left) - Placeholder */}
      <div className="w-1/4 min-w-[300px] border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-700">KiBi-AI Chat</div>
        <div className="flex-1 p-4 bg-slate-50/50">
           <div className="bg-blue-100 p-3 rounded-lg text-sm text-blue-800 mb-4">
             Welcome! Generating report for ID: {reportId}
           </div>
           {/* Chat UI would go here */}
        </div>
        <div className="p-4 border-t border-slate-200">
           <input className="form-input" placeholder="Type message..." />
        </div>
      </div>

      {/* Col 2: Report Preview */}
      <div className="flex-1 bg-gray-100 p-8 overflow-auto flex justify-center items-start">
         {/* Replaced Static Placeholder with Real Component */}
         <ReportPreview />
      </div>

      {/* Column 3: Report Builder (Right) - YOUR COMPONENT */}
        <div className="w-[500px] shrink-0 h-full relative z-10">
          <ReportConfigurator/>
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
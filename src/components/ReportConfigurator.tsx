"use client";

import React, { useState } from "react";
import "../styles/reportConfig.css"; 
import { useReport } from "@/context/ReportContext";
import { useToast } from "@/context/ToastContext";
import { validateConfig } from "@/lib/utils/reportValidation";

// Icons
import { 
  Info, Save, RotateCw 
} from "lucide-react";

// Components
import { HeaderSection } from "@/components/report-builder/HeaderSection";
import { RelationshipsSection } from "@/components/report-builder/RelationshipsSection";
import { SubSummarySection } from "@/components/report-builder/SubSummarySection";
import { ReportBodySection } from "@/components/report-builder/ReportBodySection";
import { CustomCalcsSection } from "@/components/report-builder/CustomCalcsSection";
import { ReportFiltersSection } from "@/components/report-builder/ReportFiltersSection";
import { GrandSummarySection } from "@/components/report-builder/GrandSummarySection";
import { Modal } from "@/components/ui/Modal";

export function ReportConfigurator() {

  // --- CONTEXT & HOOKS ---
  const { state, dispatch } = useReport();
  const [showJson, setShowJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { addToast } = useToast();


 // Submit Handler
  const handleUpdate = async () => {

    // Validate Config Before Saving
    const validation = validateConfig(state.config);


    if (!validation.isValid) {
      addToast("error", "Validation Error", validation.error || "Invalid Config");
      return;
    }

    if (!state.fmRecordId) return;
    setIsSaving(true);

    try {
      // 1. Save Config to DB
      const saveRes = await fetch("/api/report-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fmRecordId: state.fmRecordId,
          config: state.config
        })
      });

      if (!saveRes.ok) throw new Error("Update failed");

      // 2. Call Generation API for Live Preview
      const genRes = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_setup: state.setup,
          report_config: state.config
        })
      });

      const result = await genRes.json();
      
      if (result.status === "ok" && result.report_structure_json) {
        dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });
        addToast("success", "Success", "Configuration updated and preview generated.");
      } else {
        console.warn("Generation Warning:", result);
        addToast("warning", "Warning", "Configuration saved but preview generation had issues.");
      }

    } catch (error) {
      console.error(error);
      addToast("error", "Error", "Failed to update configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  // Loading and Setup States
  if (state.isLoading) return <div className="p-8 text-center text-indigo-600 font-medium">Loading Configuration...</div>;
  if (!state.setup) return <div className="p-8 text-center text-slate-400">Select a report to configure.</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl">
      
      {/* --- NEW HEADER SUBMIT HANDLER --- */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 z-20 shadow-sm sticky top-0">
         <h2 className="font-bold text-slate-800 text-base uppercase tracking-wide">Report Builder</h2>
         
         <div className="flex items-center gap-2">
            {/* JSON Info Icon */}
            <button 
              onClick={() => setShowJson(true)}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"
              title="View JSON Configuration"
            >
              <Info size={18} />
            </button>

            {/* Update Button */}
            <button 
              onClick={handleUpdate}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : "Update"}
            </button>
         </div>
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">
         {/* 1. Header Section */}
         <HeaderSection  />

         {/* 2. Relationships (Icon handled inside component) */}
         <RelationshipsSection /> 

         {/* 3. Sub Summary */}
         <SubSummarySection />

         {/* 4. Body */}
         <ReportBodySection />

         {/* 5. Custom Calcs (Icon handled inside component) */}
         <CustomCalcsSection /> 

         {/* 6. Filters */}
         <ReportFiltersSection/>

         {/* 7. Grand Summary */}
         <GrandSummarySection/>
      </div>

      {/* JSON Modal */}
      <Modal
        isOpen={showJson}
        onClose={() => setShowJson(false)}
        title="Current Configuration (JSON)"
      >
        <div className="h-[400px] overflow-auto bg-slate-900 p-4 rounded border border-slate-700 font-mono text-xs text-green-400">
           <pre>{JSON.stringify(state.config, null, 2)}</pre>
        </div>
        <div className="mt-4 flex justify-end">
            <button 
                onClick={() => setShowJson(false)}
                className="btn-primary"
            >
                Close
            </button>
        </div>
      </Modal>

    </div>
  );
}
"use client";

import React, { useState } from "react";
import "../styles/reportConfig.css"; 
import { useReport } from "@/context/ReportContext";
import { useToast } from "@/context/ToastContext";
import { validateConfig } from "@/lib/utils/reportValidation";
import { apiClient } from "@/utils/apiClient";
import { useParams } from "next/navigation";
import Link from "next/link";

// Icons
import { 
  Info, Zap 
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
  const params = useParams();
  const slug = params?.company_slug as string | undefined;
  const templateId = params?.template_id as string | undefined;


 // Submit Handler
  const handleUpdate = async () => {

    // Validate Config Before Saving
    const validation = validateConfig(state.config);

    if (!validation.isValid) {
      addToast("error", "Validation Error", validation.error || "Invalid Config");
      return;
    }

    if (!state.templateId) return;
    setIsSaving(true);
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // 1. Generate live preview
      const result = await apiClient.post<{ status: string; report_structure_json: any }>(
        "/api/generate-report",
        { report_setup: state.setup, report_config: state.config }
      );

      // 2. Save config + preview snapshot to Supabase
      const previewData = result.status === "ok" ? result.report_structure_json : undefined;
      await apiClient.post(`/api/templates/${state.templateId}/config`, {
        config_json: state.config,
        bump_version: true,
        ...(previewData ? { preview_data_json: previewData } : {}),
      });

      if (result.status === "ok" && result.report_structure_json) {
        dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });
        addToast("success", "Success", "Configuration saved and preview updated.");
      } else {
        console.warn("Generation Warning:", result);
        addToast("warning", "Warning", "Configuration saved but preview generation had issues.");
      }

    } catch (error) {
      console.error(error);
      addToast("error", "Error", "Failed to update configuration.");
    } finally {
      setIsSaving(false);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl">
      
      {/* --- HEADER: Update + Generate + View JSON --- */}
      <div className="px-4 py-3 bg-white flex justify-between items-center shrink-0 z-20 sticky top-0 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleUpdate}
            disabled={isSaving}
            className="bg-[#2563eb] hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? "Saving…" : "Update"}
          </button>

          {slug && templateId && (
            <Link
              href={`/${slug}/templates/${templateId}/generate`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: "#059669" }}
            >
              <Zap size={13} />
              Generate
            </Link>
          )}
        </div>
         
         <button 
           onClick={() => setShowJson(true)}
           className="text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white transition-colors px-2.5 py-2 rounded-lg font-medium text-[11px] flex items-center gap-1.5 whitespace-nowrap"
           title="View Report Config JSON"
         >
           <Info size={14} /> JSON
         </button>
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
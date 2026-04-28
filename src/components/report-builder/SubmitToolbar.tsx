// Not used , this would be removed later

"use client";

import React, { useState } from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { Modal } from "@/components/ui/Modal";

export function SubmitToolbar() {
  const { state , dispatch } = useReport();
  const [showJson, setShowJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (!state.templateId) return;
    setIsSaving(true);

    try {
      // 1. Save Config (Legacy - component is not actively used)
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_setup: state.setup,
          report_config: state.config
        })
      });

      if (!res.ok) throw new Error("Update failed");



      // 2. AUTO-REFRESH PREVIEW (Call generate-report)
      const genRes = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_setup: state.setup,   
          report_config: state.config 
        })
      });

      const result = await genRes.json();

      // 3. Update Preview Context
      if (result.status === "ok" && result.report_structure_json) {
        dispatch({ type: "SET_REPORT_PREVIEW", payload: result.report_structure_json });
        alert("Configuration saved & Preview updated!");
      } else {
        console.warn("Preview generation warning:", result);
        alert("Config saved, but preview generation had issues.");
      }
      
      alert("Report updated successfully!");
    } catch (error) {
      alert("Failed to update report.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-40 flex justify-end gap-4 items-center">
        <div className="text-sm text-slate-500 mr-auto">
            {/* Optional Status Text */}
            Ready to generate report.
        </div>
        
        <button 
          onClick={() => setShowJson(true)}
          className="px-3 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-xs font-medium whitespace-nowrap"
        >
          View JSON
        </button>
        
        <button 
          onClick={handleUpdate}
          disabled={isSaving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-xs hover:bg-indigo-700 shadow-sm transition-colors font-bold whitespace-nowrap disabled:opacity-50"
        >
          {isSaving ? "Updating…" : "Update Configuration"}
        </button>
      </div>

      {/* JSON Debug Modal */}
      <Modal
        isOpen={showJson}
        onClose={() => setShowJson(false)}
        title="Current Configuration (JSON)"
      >
        <div className="h-[400px] overflow-auto bg-slate-50 p-4 rounded border border-slate-200 font-mono text-xs text-black">
           <pre>{JSON.stringify(state.config, null, 2)}</pre>
        </div>
        <div className="mt-4 flex justify-end">
            <button 
              onClick={() => navigator.clipboard.writeText(JSON.stringify(state.config, null, 2))}
              className="text-indigo-600 text-xs hover:underline mr-4"
            >
              Copy to Clipboard
            </button>
            <button 
                onClick={() => setShowJson(false)}
                className="btn-primary"
            >
                Close
            </button>
        </div>
      </Modal>
    </>
  );
}
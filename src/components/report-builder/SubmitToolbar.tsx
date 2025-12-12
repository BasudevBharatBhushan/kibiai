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
    if (!state.fmRecordId) return;
    setIsSaving(true);

    try {
      // Call OUR internal API
      const res = await fetch("/api/report-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fmRecordId: state.fmRecordId,
          config: state.config
        })
      });

      if (!res.ok) throw new Error("Update failed");
      
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
          className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 transition-colors text-sm font-medium"
        >
          View JSON
        </button>
        
        <button 
          onClick={handleUpdate}
          disabled={isSaving}
          className="bg-indigo-600 text-white px-6 py-2 rounded text-sm hover:bg-indigo-700 shadow-sm transition-colors font-bold"
        >
          {isSaving ? "Updating..." : "Update Configuration"}
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
"use client";

import { useEffect, useState } from "react";
import { FileText, BarChart3, Calendar, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/utils/apiClient";
import DynamicReport from "@/components/DynamicReportPreview";

interface TemplatePreviewPanelProps {
  template: {
    report_template_id: string;
    report_template_name: string;
    report_template_status: string;
    version_number: number;
    created_on: string;
    updated_on?: string;
    modules?: { module_name?: string } | null;
  } | null;
}

/**
 * TemplatePreviewPanel (persistent)
 *
 * Always-visible right panel on the template list.
 * When a template is selected it fetches preview_data_json and renders the
 * real DynamicReportPreview — same quality as the configurator.
 */
export function TemplatePreviewPanel({ template }: TemplatePreviewPanelProps) {
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (!template) {
      setPreviewData(null);
      return;
    }
    if (template.report_template_id === lastTemplateId) return;

    const load = async () => {
      setIsLoading(true);
      setPreviewData(null);
      try {
        const res = await apiClient.get<{ success: boolean; data: any }>(
          `/api/templates/${template.report_template_id}/config`
        );
        if (res.success && res.data?.preview_data_json) {
          setPreviewData(res.data.preview_data_json);
        } else {
          setPreviewData(null);
        }
        setLastTemplateId(template.report_template_id);
      } catch {
        setPreviewData(null);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [template?.report_template_id]);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
          <FileText size={18} />
        </div>
        <div className="min-w-0 flex-1">
          {template ? (
            <>
              <h3 className="text-sm font-bold text-slate-900 truncate" title={template.report_template_name}>
                {template.report_template_name}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {template.modules?.module_name || "General"} · v{template.version_number}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-slate-400">Report Preview</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">Select a template to preview</p>
            </>
          )}
        </div>
      </div>

      {/* ── Meta strip (only when template selected) ── */}
      {template && (
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${template.report_template_status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className={`text-[11px] font-bold ${template.report_template_status === "Active" ? "text-emerald-600" : "text-amber-600"}`}>
              {template.report_template_status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Calendar size={11} />
            {new Date(template.updated_on || template.created_on).toLocaleDateString()}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {!template ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <BarChart3 size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Select a template</p>
            <p className="text-xs text-slate-300 mt-1 max-w-[180px]">
              Click any row to preview its latest report output
            </p>
          </div>
        ) : isLoading ? (
          /* Skeleton */
          <div className="p-4 space-y-3 animate-pulse">
            <div className="bg-white shadow rounded mx-auto" style={{ width: "210mm", minHeight: "60px", maxWidth: "100%", padding: "12px" }}>
              <div className="flex justify-between mb-4">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-6 w-36 bg-slate-100 rounded" />
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 w-full bg-slate-50 rounded mb-2" />
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={13} className="animate-spin" />
              Loading preview…
            </div>
          </div>
        ) : previewData && previewData.length > 0 ? (
          /* Real report preview */
          <div className="h-full overflow-auto">
            <DynamicReport jsonData={previewData} />
          </div>
        ) : (
          /* No preview data */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
              <RefreshCw size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No preview available</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Open this template in the configurator to generate a preview.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

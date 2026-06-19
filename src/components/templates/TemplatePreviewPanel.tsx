"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
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

function normalizePreviewData(rawData: any): any[] | null {
  if (!rawData) return null;
  if (Array.isArray(rawData)) return rawData;

  if (Array.isArray(rawData.report_structure_json)) {
    return rawData.report_structure_json;
  }

  if (rawData.ReportStructuredData) {
    try {
      const parsed =
        typeof rawData.ReportStructuredData === "string"
          ? JSON.parse(rawData.ReportStructuredData)
          : rawData.ReportStructuredData;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * TemplatePreviewPanel
 * Clean preview panel — no toolbar, no pagination controls, no header strip.
 * Uses DynamicReport in previewMode to show report content directly.
 *
 * Preloading behaviour:
 *   - First load (no prior data): shows full animated skeleton.
 *   - Template switch (prior data exists): keeps old preview visible behind
 *     a translucent skeleton overlay while the new data loads.
 *   - No data (after load): shows a static skeleton layout + "no preview" message.
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
      // Do NOT clear previewData here — keep old data visible while loading
      try {
        const res = await apiClient.get<{ success: boolean; data: any }>(
          `/api/templates/${template.report_template_id}/config`
        );
        if (res.success && res.data?.preview_data_json) {
          setPreviewData(normalizePreviewData(res.data.preview_data_json));
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

  /* ── Shared skeleton structure (animated) ── */
  const SkeletonBlock = () => (
    <div className="p-5 space-y-3 animate-pulse w-full">
      <div className="bg-white shadow rounded-lg p-5">
        <div className="flex justify-between mb-5">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-7 w-40 bg-slate-100 rounded" />
        </div>
        <div className="h-px bg-slate-100 mb-4" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-3 w-full bg-slate-50 rounded mb-2.5" />
        ))}
        <div className="h-px bg-slate-100 my-4" />
        {[...Array(5)].map((_, i) => (
          <div
            key={`b${i}`}
            className="h-3 bg-slate-50 rounded mb-2"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
        <Loader2 size={13} className="animate-spin" />
        Loading preview…
      </div>
    </div>
  );

  /* ── No template selected ── */
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 bg-slate-50/40">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <BarChart3 size={28} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Select a template</p>
        <p className="text-xs text-slate-300 mt-1 max-w-[180px]">
          Click any row to preview its latest report output
        </p>
      </div>
    );
  }

  /* ── First load (no prior data) → full skeleton ── */
  if (isLoading && !previewData) {
    return (
      <div className="h-full overflow-auto bg-gray-100">
        <SkeletonBlock />
      </div>
    );
  }

  /* ── No data returned → static skeleton + message ── */
  if (!previewData || previewData.length === 0) {
    return (
      <div className="h-full overflow-auto bg-gray-100">
        {/* Static skeleton layout so the panel shows structure */}
        <div className="p-5 space-y-3">
          <div className="bg-white shadow rounded-lg p-5 opacity-40">
            <div className="flex justify-between mb-5">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-40 bg-slate-200 rounded" />
            </div>
            <div className="h-px bg-slate-200 mb-4" />
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-3 w-full bg-slate-100 rounded mb-2.5" />
            ))}
            <div className="h-px bg-slate-200 my-4" />
            {[...Array(4)].map((_, i) => (
              <div
                key={`b${i}`}
                className="h-3 bg-slate-100 rounded mb-2"
                style={{ width: `${75 - i * 12}%` }}
              />
            ))}
          </div>
        </div>
        {/* Informational message below skeleton */}
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-3">
            <RefreshCw size={18} className="text-slate-300" />
          </div>
          <p className="text-xs font-semibold text-slate-500">No preview available</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[180px]">
            Open this template in the configurator to generate a preview.
          </p>
        </div>
      </div>
    );
  }

  /* ── Report preview (previewMode = no toolbar, no pagination controls) ── */
  return (
    <div className="h-full overflow-auto bg-gray-100 relative">
      {/* Skeleton overlay while switching templates — old report stays visible */}
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-gray-100/80 backdrop-blur-[1px] flex items-start">
          <SkeletonBlock />
        </div>
      )}
      <DynamicReport jsonData={previewData} previewMode={true} />
    </div>
  );
}

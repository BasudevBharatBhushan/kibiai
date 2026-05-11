"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  FileText,
  Calendar,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useHeader } from "@/context/HeaderContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";
import { ReportPreview } from "@/components/ReportPreview";
import { ReportProvider, useReport } from "@/context/ReportContext";
import { buildReportMetadata } from "@/lib/utils/reportMetadata";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SavedReport {
  report_id: string;
  report_name: string;
  created_on: string;
  report_data_json: any;
  report_config_json: any;
  report_template_setup_json?: Record<string, unknown> | null;
  report_insight?: string;
  report_templates?: { report_template_name?: string } | null;
}

interface Chart {
  chart_id: string;
  chart_name: string;
  chart_type: string;
  chart_json: any;
  created_on: string;
}

// ── Chart Card ─────────────────────────────────────────────────────────────────

function ChartCard({ chart }: { chart: Chart }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 shrink-0">
          <BarChart3 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{chart.chart_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{chart.chart_type}</p>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Calendar size={10} />
            {new Date(chart.created_on).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page Content ───────────────────────────────────────────────────────────────

function ReportDetailContent({
  reportId,
  slug,
}: {
  reportId: string;
  slug: string;
}) {
  const { dispatch } = useReport();
  const { setBreadcrumbs, setBackHref } = useHeader();
  const { addToast } = useToast();

  const [report, setReport] = useState<SavedReport | null>(null);
  const [charts, setCharts] = useState<Chart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartsLoading, setIsChartsLoading] = useState(true);

  const reportMetadata = useMemo(() => {
    if (!report) return undefined;
    return buildReportMetadata(
      report.report_config_json ?? null,
      (report.report_template_setup_json ?? null) as Record<string, unknown> | null
    );
  }, [report]);

  // Load report
  useEffect(() => {
    if (!reportId) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: SavedReport }>(
          `/api/reports/${reportId}`
        );
        if (!res.success || !res.data) throw new Error("Report not found");

        setReport(res.data);

        // Load into ReportContext so ReportPreview renders
        if (res.data.report_data_json) {
          dispatch({
            type: "SET_REPORT_PREVIEW",
            payload: res.data.report_data_json,
          });
        }

        setBreadcrumbs([
          { label: "Reports", href: `/${slug}/reports` },
          { label: res.data.report_name },
        ]);
        setBackHref(`/${slug}/reports`);
      } catch (err: any) {
        addToast("error", "Load Error", err.message || "Failed to load report.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // Load charts
  useEffect(() => {
    if (!reportId) return;
    const loadCharts = async () => {
      setIsChartsLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; charts: Chart[] }>(
          `/api/reports/${reportId}/charts`
        );
        if (res.success) setCharts(res.charts ?? []);
      } catch {
        // Charts are optional
      } finally {
        setIsChartsLoading(false);
      }
    };
    loadCharts();
  }, [reportId]);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8 animate-pulse space-y-6">
        <div className="h-6 w-48 bg-slate-100 rounded-xl" />
        <div className="h-10 w-80 bg-slate-100 rounded-xl" />
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="h-[60vh] bg-slate-50 rounded-2xl border border-slate-100" />
          <div className="h-[60vh] bg-slate-50 rounded-2xl border border-slate-100" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <FileText size={40} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">Report Not Found</h2>
        <Link
          href={`/${slug}/reports`}
          className="text-blue-600 text-sm hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

      {/* Back nav */}
      <Link
        href={`/${slug}/reports`}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium"
      >
        <ArrowLeft size={14} /> Back to Reports
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{report.report_name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Calendar size={11} />
              {new Date(report.created_on).toLocaleString()}
            </span>
            {report.report_templates?.report_template_name && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold border border-slate-200">
                {report.report_templates.report_template_name}
              </span>
            )}
          </div>
          {report.report_insight && (
            <p className="text-sm text-slate-500 mt-2 max-w-xl">{report.report_insight}</p>
          )}
        </div>
      </div>

      {/* Split: Report preview (left) + Charts (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

        {/* Report Preview */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <FileText size={15} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Report Data
            </h2>
            <span className="ml-auto text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Read-only snapshot
            </span>
          </div>
          <div className="p-4 bg-gray-50 overflow-auto max-h-[70vh]">
            <ReportPreview metadata={reportMetadata} />
          </div>
        </div>

        {/* Charts Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 size={15} className="text-purple-500" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Charts
            </h2>
            <span className="ml-auto text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              {charts.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isChartsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-slate-50 rounded-xl border border-slate-100" />
                ))}
              </div>
            ) : charts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-3">
                  <BarChart3 size={20} className="text-purple-300" />
                </div>
                <p className="text-sm text-slate-500 font-medium">No charts yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Charts linked to this report will appear here.
                </p>
                <Link
                  href={`/${slug}/reports/${reportId}/charts`}
                  className="mt-3 text-xs font-bold text-purple-600 hover:underline"
                >
                  Open Chart Builder →
                </Link>
              </div>
            ) : (
              <>
                {charts.map((chart) => (
                  <ChartCard key={chart.chart_id} chart={chart} />
                ))}
                <Link
                  href={`/${slug}/reports/${reportId}/charts`}
                  className="block mt-2 text-center text-xs font-bold text-purple-600 hover:underline py-2"
                >
                  Open Chart Builder →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page Route ─────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const reportId = params?.report_id as string;

  return (
    <ReportProvider>
      <ReportDetailContent reportId={reportId} slug={slug} />
    </ReportProvider>
  );
}

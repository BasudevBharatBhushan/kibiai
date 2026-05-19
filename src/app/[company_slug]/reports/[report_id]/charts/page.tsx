"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { BarChart3, FileText } from "lucide-react";

import DashboardGrid from "@/components/chart-dashboard/DashboardGrid";
import { DashboardProvider } from "@/context/DashboardContext";
import { useHeader } from "@/context/HeaderContext";
import { useToast } from "@/context/ToastContext";
import type { ReportChartSchema } from "@/lib/charts/ChartTypes";
import { buildInsightContextFromReportConfig } from "@/lib/charts/insightContextBuilder";
import { deriveFieldSchemas } from "@/lib/insights/fieldSchemaAdapter";
import { apiClient } from "@/utils/apiClient";

type ReportChartsResponse = {
  report_id: string;
  report_name: string;
  report_template_id: string;
  created_on: string;
  report_config_json: Record<string, unknown> | null;
  report_template_config_json: Record<string, unknown> | null;
  report_template_setup_json: Record<string, unknown> | null;
  rows: Array<Record<string, unknown>>;
  schemas: ReportChartSchema[];
  canvasState: Array<Record<string, unknown>>;
  layoutMode: string;
};

function ViewerSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg animate-pulse">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div className="space-y-2 text-center">
          <div className="h-4 w-52 rounded bg-slate-200 animate-pulse" />
          <div className="h-3 w-36 rounded bg-slate-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function ReportChartsViewerPage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const reportId = params?.report_id as string;

  const { addToast } = useToast();
  const { setBackHref, setBreadcrumbs } = useHeader();

  const [pageData, setPageData] = useState<ReportChartsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!reportId || !slug) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: ReportChartsResponse }>(
          `/api/reports/${reportId}`
        );

        if (!res.success || !res.data) {
          throw new Error("Failed to load report charts");
        }

        setPageData(res.data);
        setBreadcrumbs([
          { label: "Reports", href: `/${slug}/reports` },
          { label: res.data.report_name || reportId },
          { label: "Charts" },
        ]);
        setBackHref(`/${slug}/reports`);
      } catch (error: unknown) {
        addToast(
          "error",
          "Load Error",
          error instanceof Error
            ? error.message
            : "Failed to load report charts."
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [addToast, reportId, setBackHref, setBreadcrumbs, slug]);

  const insightContext = useMemo(
    () => buildInsightContextFromReportConfig(
      pageData?.report_config_json ?? null,
      pageData?.report_template_setup_json ?? null
    ),
    [pageData]
  );

  const fieldSchemas = useMemo(() => {
    if (!pageData) return [];
    return deriveFieldSchemas(
      pageData.report_template_config_json,
      pageData.report_template_setup_json
    );
  }, [pageData]);

  if (isLoading || !pageData) {
    return <ViewerSkeleton />;
  }

  return (
    <DashboardProvider
      initialSchemas={pageData.schemas}
      initialDataset={pageData.rows}
      initialCanvasState={pageData.canvasState}
      initialLayoutMode={pageData.layoutMode}
      templateId={pageData.report_template_id}
      context={insightContext}
      fieldSchemas={fieldSchemas}
      isViewerMode
    >
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-50 font-sans">
        <header className="shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur flex items-center gap-4 z-20">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-blue-700">
                Chart Viewer
              </h1>
              <span className="text-slate-300 font-light">/</span>
              <span className="truncate text-sm font-medium text-slate-600">
                {pageData.report_name}
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wide text-slate-500">
              Frozen report data · read-only
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-slate-50">
          {pageData.schemas.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                  <FileText className="h-6 w-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    No chart templates are linked to this report template yet.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Create charts from the template configurator first.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <DashboardGrid />
          )}
        </div>
      </div>
    </DashboardProvider>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BarChart3, CalendarDays, FileText } from "lucide-react";

import { useHeader } from "@/context/HeaderContext";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/utils/apiClient";

type SavedReportListItem = {
  report_id: string;
  report_name: string;
  created_on: string;
  report_template_id: string;
  report_templates?: {
    report_template_name?: string;
  } | null;
};

function ReportsSkeleton() {
  return (
    <div className="animate-pulse space-y-6 py-8">
      <div className="h-8 w-56 bg-slate-100 rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-16 bg-slate-50 rounded-xl border border-slate-100"
          />
        ))}
      </div>
    </div>
  );
}

export default function CompanyReportsPage() {
  const params = useParams();
  const slug = params?.company_slug as string;
  const { addToast } = useToast();
  const { setBackHref, setBreadcrumbs } = useHeader();

  const [reports, setReports] = useState<SavedReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setBreadcrumbs([{ label: "Reports" }]);
    setBackHref(`/${slug}`);
  }, [setBackHref, setBreadcrumbs, slug]);

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: SavedReportListItem[];
        }>("/api/reports");

        if (!res.success) {
          throw new Error("Failed to load saved reports");
        }

        setReports(res.data ?? []);
      } catch (error: unknown) {
        addToast(
          "error",
          "Load Error",
          error instanceof Error
            ? error.message
            : "Failed to load saved reports."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [addToast]);

  if (isLoading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">Saved Reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          Open immutable report snapshots and render their chart templates.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Report
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="text-left px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Generated
                </th>
                <th className="text-right px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <FileText size={24} className="text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">
                        No saved reports found
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Generate and save a report first to open charts here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr
                    key={report.report_id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {report.report_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            ID: {report.report_id.split("-")[0]}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold border border-slate-200">
                        {report.report_templates?.report_template_name ||
                          "Unknown Template"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <CalendarDays size={13} />
                        {new Date(report.created_on).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {slug !== "equiparts" && (
                        <Link
                          href={`/${slug}/reports/${report.report_id}/charts`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                          style={{ background: "#2563eb" }}
                        >
                          <BarChart3 size={13} />
                          Open Charts
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import Dashboard from '@/components/chart-dashboard/DashboardGrid';
import {
  fetchChartConfiguration,
  fetchReportData,
} from '@/app/api/charts/api';

interface PageProps {
  searchParams: {
    report_id?: string;
  };
}

// Chart Dashboard Page
export default async function ChartsPage({
  searchParams,
}: PageProps) {
  // 1. Resolve searchParams
  const resolvedSearchParams = await searchParams;

  // 2. Validate report_id
  const reportId =
    typeof resolvedSearchParams.report_id === 'string'
      ? resolvedSearchParams.report_id
      : '';

  if (!reportId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Please provide a report_id in the URL (e.g., ?report_id=12)
      </div>
    );
  }

  // 3. Parallel Data Fetching
  const [schemas, report] = await Promise.all([
    fetchChartConfiguration(reportId),
    fetchReportData(reportId),
  ]);

  return (
    <main className="min-h-screen w-full bg-slate-50">
      <Dashboard
        initialSchemas={schemas}
        initialDataset={report.rows}
        initialCanvasState={report.canvasState}
        initialLayoutMode={report.layoutMode}
        reportRecordId={report.reportRecordId}
      />
    </main>
  );
}

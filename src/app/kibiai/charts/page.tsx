import React from 'react';
import Dashboard from '@/components/chart-dashboard/DashboardGrid';
import { fetchChartConfiguration, fetchReportData } from '@/app/api/charts/api';


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChartsPage({ searchParams }: PageProps) {
 
  const resolvedParams = await searchParams;
  
  const reportId = typeof resolvedParams.report_id === 'string' 
    ? resolvedParams.report_id 
    : '';

  if (!reportId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        Please provide a report_id in the URL (e.g., ?report_id=12)
      </div>
    );
  }

  const [schemas, dataset] = await Promise.all([
    fetchChartConfiguration(reportId),
    fetchReportData(reportId)
  ]);

  return (
    <main className="min-h-screen w-full bg-slate-50">
      <Dashboard 
        initialSchemas={schemas} 
        initialDataset={dataset} 
      />
    </main>
  );
}
import React from 'react';
import Dashboard from '@/components/chart-dashboard/DashboardGrid'; 
import { fetchChartConfiguration , fetchReportData } from '@/app/api/charts/api';

interface PageProps {
  params: Promise<{ reportId: string }>;
}

export default async function DynamicReportPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { reportId } = resolvedParams;

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
'use client';
import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import('@/components/chart-dashboard/DashboardGrid').then(m => m.default), {ssr: false});

export default function Page() {
  return (
    <section>
      <Dashboard />
    </section>
  );
}
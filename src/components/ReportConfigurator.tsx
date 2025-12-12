"use client";

import { useEffect } from "react";
import { HeaderSection } from "@/components/report-builder/HeaderSection";
import { RelationshipsSection } from "@/components/report-builder/RelationshipsSection";
import { useReport } from "@/context/ReportContext";
// import { MOCK_SETUP } from "@/lib/mockData";
import { SubSummarySection } from "@/components/report-builder/SubSummarySection";
import { ReportBodySection } from "@/components/report-builder/ReportBodySection";
import { CustomCalcsSection } from "@/components/report-builder/CustomCalcsSection";
import { ReportFiltersSection } from "@/components/report-builder/ReportFiltersSection";
import { GrandSummarySection } from "@/components/report-builder/GrandSummarySection";
import { SubmitToolbar } from "@/components/report-builder/SubmitToolbar";

export default function ReportConfigurator() {


const { state } = useReport();

  // Load Mock Data on Mount
  // useEffect(() => {
  //   dispatch({ type: "LOAD_SETUP", payload: MOCK_SETUP });
  // }, [dispatch]);

  if (state.isLoading) {
    return <div className="p-8 text-center text-indigo-600">Loading Configuration...</div>;
  }

  if (!state.setup) {
    return <div className="p-8 text-center text-slate-400">Select a report to configure.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl">
      {/* Title Bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
         <h2 className="font-bold text-slate-800">Report Builder</h2>
         <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
         <HeaderSection />
         <RelationshipsSection />
         <SubSummarySection />
         <ReportBodySection />
         <CustomCalcsSection />
         <ReportFiltersSection />
         <GrandSummarySection />
      </div>

      {/* Footer */}
      <SubmitToolbar />
    </div>
  );

}
"use client";

import { useEffect } from "react";
import { HeaderSection } from "@/components/report-builder/HeaderSection";
import { RelationshipsSection } from "@/components/report-builder/RelationshipsSection";
import { useReport } from "@/context/ReportContext";
import { MOCK_SETUP } from "@/lib/mockData";
import { SubSummarySection } from "@/components/report-builder/SubSummarySection";
import { ReportBodySection } from "@/components/report-builder/ReportBodySection";
import { CustomCalcsSection } from "@/components/report-builder/CustomCalcsSection";
import { ReportFiltersSection } from "@/components/report-builder/ReportFiltersSection";
import { GrandSummarySection } from "@/components/report-builder/GrandSummarySection";
import { SubmitToolbar } from "@/components/report-builder/SubmitToolbar";

export default function ReportBuilderPage() {
const { state, dispatch } = useReport();

  // Load Mock Data on Mount
  useEffect(() => {
    dispatch({ type: "LOAD_SETUP", payload: MOCK_SETUP });
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans pb-24"> {/* Extra padding-bottom for toolbar */}
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Report Builder</h1>
        </div>

        {/* 1. Header */}
        <HeaderSection />

        {/* 2. Relationships (Logic + Visual) */}
        
        <RelationshipsSection />

        {/* 3. Sub-Summaries */}
        <SubSummarySection />

        {/* 4. Body */}
        <ReportBodySection />

        {/* 5. Calculations */}
        <CustomCalcsSection />

        {/* 6. Filters */}
        <ReportFiltersSection />

        {/* 7. Grand Summary */}
        <GrandSummarySection />

      </div>

      {/* Sticky Footer */}
      <SubmitToolbar />
    </div>
  );

}
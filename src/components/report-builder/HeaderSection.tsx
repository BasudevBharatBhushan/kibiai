"use client";

import React from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";

export function HeaderSection() {
  const { state, dispatch } = useReport();
  const { report_header, response_to_user } = state.config;

  return (
    <CollapsibleCard title="Report Header" defaultOpen={true}>
      <div className="space-y-4">
        <div>
          <label className="form-label">Report Title</label>
          <input
            type="text"
            value={report_header}
            onChange={(e) => dispatch({ type: "SET_HEADER", payload: e.target.value })}
            className="form-input"
            placeholder="e.g. Sales Summary March 2025"
          />
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea
            rows={3}
            value={response_to_user}
            onChange={(e) => dispatch({ type: "SET_DESCRIPTION", payload: e.target.value })}
            className="form-input"
            placeholder="Describe what this report does..."
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
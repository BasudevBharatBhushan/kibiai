"use client";

import React, { useState, useRef, useCallback, startTransition } from "react";
import "../styles/reportConfig.css"; 
import { useReport } from "@/context/ReportContext";
import { useToast } from "@/context/ToastContext";
import { validateConfig } from "@/lib/utils/reportValidation";
import { apiClient } from "@/utils/apiClient";
import { useParams } from "next/navigation";
import { Loader2, Info, RefreshCw, LayoutList, Printer } from "lucide-react";
import { classifyReload, applySoftReload } from "@/lib/utils/reportReloadClassifier";

// Components
import { HeaderSection } from "@/components/report-builder/HeaderSection";
import { RelationshipsSection } from "@/components/report-builder/RelationshipsSection";
import { SubSummarySection } from "@/components/report-builder/SubSummarySection";
import { ReportBodySection } from "@/components/report-builder/ReportBodySection";
import { CustomCalcsSection } from "@/components/report-builder/CustomCalcsSection";
import { ReportFiltersSection } from "@/components/report-builder/ReportFiltersSection";
import { GrandSummarySection } from "@/components/report-builder/GrandSummarySection";
import { ClassicViewSettingsSection, type ClassicViewSettings, type FilterField } from "@/components/report-builder/ClassicViewSettingsSection";
import { Modal } from "@/components/ui/Modal";
import { SqlExecutionFloater, type SqlStep } from "@/components/SqlExecutionFloater";

interface ReportConfiguratorProps {
  classicSettings?: ClassicViewSettings;
  onClassicSettingsChange?: (key: keyof ClassicViewSettings, value: boolean) => void;
  viewMode?: "classic" | "print";
  onViewModeChange?: (mode: "classic" | "print") => void;
  filterFields?: FilterField[];
  dateFields?: string[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (field: string, value: string) => void;
}

export function ReportConfigurator({
  classicSettings,
  onClassicSettingsChange,
  viewMode = "classic",
  onViewModeChange,
  filterFields,
  dateFields,
  activeFilters,
  onFilterChange,
}: ReportConfiguratorProps = {}) {

  // --- CONTEXT & HOOKS ---
  const { state, dispatch } = useReport();
  const [showJson, setShowJson] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSqlStep, setCurrentSqlStep] = useState<SqlStep | null>(null);
  const { addToast } = useToast();
  const params = useParams();
  const slug = params?.company_slug as string | undefined;
  const templateId = params?.template_id as string | undefined;
  const abortRef = useRef<AbortController | null>(null);
  const hardReloadRef = useRef<(confirmLarge?: boolean) => Promise<void>>();

  // ---------------------------------------------------------------------------
  // Hard reload: saves config to DB then re-fetches via SSE stream
  // ---------------------------------------------------------------------------
  const hardReload = useCallback(async (confirmLarge = false) => {
    if (!state.templateId) return;

    // Cancel any previous in-flight stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSaving(true);
    dispatch({ type: "SET_PROCESSING_LOGS", payload: [] });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Step 1: Save Config to DB
      await apiClient.post(`/api/templates/${state.templateId}/config`, {
        config_json: state.config,
        bump_version: true,
      });

      // Step 2: Run SSE stream to generate preview + persist + show live logs
      const response = await fetch(
        `/api/templates/${state.templateId}/generate/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persist_to_template: true,
            config_json: state.config,
            ...(confirmLarge ? { confirm_large: true } : {}),
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const logs: string[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;
          let event: any;
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "log") {
            logs.push(event.message as string);
            dispatch({ type: "SET_PROCESSING_LOGS", payload: [...logs] });
          } else if (event.type === "sql_step") {
            setCurrentSqlStep({ label: event.label as string, sql: event.sql as string });
          } else if (event.type === "done") {
            const structured = event.report_structure_json;
            if (structured) {
              const isGrouped =
                event.nested_report &&
                event.nested_report.groups &&
                event.nested_report.groups.length > 0;
              // Use startTransition so rendering hundreds of group rows doesn't block the UI.
              startTransition(() => {
                if (event.nested_report) {
                  dispatch({
                    type: "SET_REPORT_PREVIEW",
                    payload: {
                      report_structure_json: structured,
                      nested_report: event.nested_report,
                    },
                  });
                  if (isGrouped) {
                    dispatch({ type: "UPDATE_CLASSIC_SETTINGS", payload: { collapseBody: true } });
                  }
                } else {
                  dispatch({ type: "SET_REPORT_PREVIEW", payload: structured });
                }
              });
            }
            // Snapshot the config so future soft reloads have a baseline
            dispatch({ type: "SET_LAST_GENERATED_CONFIG", payload: state.config });
            addToast("success", "Updated", "Configuration saved and preview updated.");
          } else if (event.type === "warn_large") {
            reader.cancel();
            setIsSaving(false);
            dispatch({ type: "SET_LOADING", payload: false });
            const rowCount: number = event.row_count ?? 0;
            const confirmed = window.confirm(
              `This report would return ${rowCount.toLocaleString()} rows which exceeds the 30,000-row preview limit.\n\nDo you want to load all rows anyway? This may take longer.`
            );
            if (confirmed) {
              await hardReloadRef.current?.(true);
            }
            return;
          } else if (event.type === "error") {
            throw new Error(event.message || "Report generation failed.");
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("[ReportConfigurator] hardReload error:", err);
        addToast("error", "Error", err.message || "Failed to update configuration.");
      }
    } finally {
      setIsSaving(false);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.templateId, state.config, dispatch, addToast]);

  hardReloadRef.current = hardReload;

  // ---------------------------------------------------------------------------
  // Soft reload: re-renders preview client-side without hitting the backend
  // ---------------------------------------------------------------------------
  const softReload = useCallback(async () => {
    if (!state.templateId) return;

    setIsSaving(true);
    try {
      // Persist the cosmetic-only config change to DB (cheap, no stream)
      await apiClient.post(`/api/templates/${state.templateId}/config`, {
        config_json: state.config,
        bump_version: false,
      });

      // Re-apply generateReportStructure locally using cached raw rows
      const updated = applySoftReload(state.stitchResult, state.config, state.setup);
      if (updated) {
        dispatch({ type: "SET_REPORT_PREVIEW", payload: updated });
        addToast("success", "Updated", "Preview refreshed instantly.");
      } else {
        // No cached stitch data — fall back to a hard reload
        await hardReload();
      }
    } catch (err: any) {
      console.error("[ReportConfigurator] softReload error:", err);
      addToast("error", "Error", err.message || "Failed to update configuration.");
    } finally {
      setIsSaving(false);
    }
  }, [state.templateId, state.config, state.stitchResult, state.setup, dispatch, addToast, hardReload]);

  // ---------------------------------------------------------------------------
  // Smart entry point: decides hard vs soft automatically
  // ---------------------------------------------------------------------------
  const handleUpdate = useCallback(async () => {
    const validation = validateConfig(state.config);
    if (!validation.isValid) {
      addToast("error", "Validation Error", validation.error || "Invalid Config");
      return;
    }

    const reloadType = classifyReload(state.config, state.lastGeneratedConfig);
    if (reloadType === "soft") {
      await softReload();
    } else {
      await hardReload();
    }
  }, [state.config, state.lastGeneratedConfig, addToast, softReload, hardReload]);

  // Force Refresh: always triggers a hard reload regardless of classification
  const handleForceRefresh = useCallback(async () => {
    const validation = validateConfig(state.config);
    if (!validation.isValid) {
      addToast("error", "Validation Error", validation.error || "Invalid Config");
      return;
    }
    await hardReload();
  }, [state.config, addToast, hardReload]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl">
      
      {/* --- HEADER: Update + View Toggle + JSON --- */}
      <div className="px-4 py-3 bg-white flex justify-between items-center shrink-0 z-20 sticky top-0 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleUpdate}
            disabled={isSaving}
            className="bg-[#2563eb] hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving
              ? <><Loader2 size={11} className="animate-spin" />Saving…</>
              : "Update"}
          </button>

          {/* Force Refresh */}
          <button
            onClick={handleForceRefresh}
            disabled={isSaving}
            title="Force a full data refresh from the server"
            className="text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 bg-white transition-colors p-2 rounded-lg disabled:opacity-40"
          >
            <RefreshCw size={13} className={isSaving ? "animate-spin" : ""} />
          </button>

          {/* Classic | Print view toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => onViewModeChange?.("classic")}
              title="Classic View — interactive collapsible table"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                viewMode === "classic"
                  ? "bg-white text-teal-600 shadow-sm border border-teal-100"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutList size={11} />
              Classic
            </button>
            <button
              onClick={() => onViewModeChange?.("print")}
              title="Print View — paginated A4 layout"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                viewMode === "print"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Printer size={11} />
              Print
            </button>
          </div>
        </div>
         
         <button 
           onClick={() => setShowJson(true)}
           className="text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white transition-colors px-2.5 py-2 rounded-lg font-medium text-[11px] flex items-center gap-1.5 whitespace-nowrap"
           title="View Report Config JSON"
         >
           <Info size={14} /> JSON
         </button>
      </div>

      {/* --- SCROLLABLE CONTENT --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12 scrollbar-minimal">

         {/* 0. Classic View Settings — shown FIRST when in Classic mode */}
         {viewMode === "classic" && classicSettings && onClassicSettingsChange && (
             <ClassicViewSettingsSection
             settings={classicSettings}
             onChange={onClassicSettingsChange}
             filterFields={filterFields}
             dateFields={dateFields}
             activeFilters={activeFilters}
             onFilterChange={onFilterChange}
           />
         )}

         {/* 1. Header Section */}
         <HeaderSection  />

         {/* 2. Relationships (Icon handled inside component) */}
         <RelationshipsSection /> 

         {/* 3. Sub Summary */}
         <SubSummarySection />

         {/* 4. Body */}
         <ReportBodySection />

         {/* 5. Custom Calcs (Icon handled inside component) */}
         <CustomCalcsSection /> 

         {/* 6. Filters */}
         <ReportFiltersSection/>

         {/* 7. Grand Summary */}
         <GrandSummarySection/>
      </div>

      {/* SQL Execution Floater — glass overlay showing live SQL during generation */}
      <SqlExecutionFloater currentStep={currentSqlStep} isGenerating={isSaving} />

      {/* JSON Modal */}
      <Modal
        isOpen={showJson}
        onClose={() => setShowJson(false)}
        title="Current Configuration (JSON)"
      >
        <div className="h-[400px] overflow-auto scrollbar-minimal bg-slate-900 p-4 rounded border border-slate-700 font-mono text-xs text-green-400">
           <pre>{JSON.stringify(state.config, null, 2)}</pre>
        </div>
        <div className="mt-4 flex justify-end">
            <button 
                onClick={() => setShowJson(false)}
                className="btn-primary"
            >
                Close
            </button>
        </div>
      </Modal>

    </div>
  );
}

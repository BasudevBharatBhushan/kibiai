"use client";

import React, { useState, useEffect, useRef } from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import {FILTER_OPERATORS} from "@/constants/reportOptions";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { X , SlidersHorizontal } from "lucide-react";

interface FilterRow {
  id: string;
  table: string;
  field: string;
  operator: string;
  value: string;
  startDate?: string;
  endDate?: string;
}

// Helper functions for Date conversion between FileMaker (MM/DD/YYYY) and HTML5 (YYYY-MM-DD)
const toHtmlDate = (fmDate: string) => {
  if (!fmDate) return "";
  const parts = fmDate.trim().split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return fmDate;
};

const toFmDate = (htmlDate: string) => {
  if (!htmlDate) return "";
  const parts = htmlDate.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${parseInt(m)}/${parseInt(d)}/${y}`;
  }
  return htmlDate;
};

export function ReportFiltersSection() {
  // --- CONTEXT & HOOKS ---
  const { state, dispatch } = useReport();
  const { getConnectedTables, getFieldOptions } = useSchema();

  // --- STATE ---
  const [dateRows, setDateRows] = useState<FilterRow[]>([]);
  const [filterRows, setFilterRows] = useState<FilterRow[]>([]);

  // --- REFS FOR SYNC CONTROL ---
  // lastXSyncRef: tracks the last stringified config pushed IN or OUT, to prevent infinite loops.
  // isXInitialized: guards Effect 2 (sync-back) so it never fires before Effect 1 has loaded rows.
  const lastDateSyncRef = useRef<string>("");
  const lastFilterSyncRef = useRef<string>("");
  const isDateInitialized = useRef<boolean>(false);
  const isFilterInitialized = useRef<boolean>(false);

  // 1. Load Initial State & React to Copilot Updates
  useEffect(() => {
    const configDatesStr = JSON.stringify(state.config.date_range_fields || {});
    if (configDatesStr !== lastDateSyncRef.current) {
      const loadedDates: FilterRow[] = [];
      Object.entries(state.config.date_range_fields || {}).forEach(([table, fields]) => {
        Object.entries(fields).forEach(([field, value]) => {
          const [start, end] = value.split("...").map(s => s.trim());
          loadedDates.push({
            id: Math.random().toString(36),
            table,
            field,
            operator: "...",
            value,
            startDate: toHtmlDate(start),
            endDate: toHtmlDate(end)
          });
        });
      });
      setDateRows(loadedDates);
      lastDateSyncRef.current = configDatesStr;
      isDateInitialized.current = true;
    }

    const configFiltersStr = JSON.stringify(state.config.filters || {});
    if (configFiltersStr !== lastFilterSyncRef.current) {
      const loadedFilters: FilterRow[] = [];
      Object.entries(state.config.filters || {}).forEach(([table, fields]) => {
        Object.entries(fields).forEach(([field, rawValue]) => {
          // Ensure string comparison even if DB stored a number
          const strVal = String(rawValue ?? "");
          let op = "==";
          let val = strVal;
          if (strVal === "*" || strVal === "=") { op = strVal; val = ""; }
          else if (strVal.startsWith(">=")) { op = ">="; val = strVal.substring(2); }
          else if (strVal.startsWith("<=")) { op = "<="; val = strVal.substring(2); }
          else if (strVal.startsWith("==")) { op = "=="; val = strVal.substring(2); }
          else if (strVal.startsWith(">")) { op = ">"; val = strVal.substring(1); }
          else if (strVal.startsWith("<")) { op = "<"; val = strVal.substring(1); }
          
          loadedFilters.push({
            id: Math.random().toString(36),
            table,
            field,
            operator: op,
            value: val
          });
        });
      });
      setFilterRows(loadedFilters);
      lastFilterSyncRef.current = configFiltersStr;
      isFilterInitialized.current = true;
    }
  }, [state.config.date_range_fields, state.config.filters]);


  // 2. Sync State back to context — guarded so it never fires before Effect 1 initializes rows
  useEffect(() => {
    if (!isDateInitialized.current) return; // don't wipe context before first load
    const newConfig: Record<string, Record<string, string>> = {};
    dateRows.forEach(row => {
      if (row.table && row.field && row.startDate && row.endDate) {
        if (!newConfig[row.table]) newConfig[row.table] = {};
        const fmStart = toFmDate(row.startDate);
        const fmEnd = toFmDate(row.endDate);
        newConfig[row.table][row.field] = `${fmStart}...${fmEnd}`;
      }
    });
    const str = JSON.stringify(newConfig);
    if (str !== lastDateSyncRef.current) {
      lastDateSyncRef.current = str;
      dispatch({ type: "SYNC_DATE_RANGES", payload: newConfig });
    }
  }, [dateRows, dispatch]);

  useEffect(() => {
    if (!isFilterInitialized.current) return; // don't wipe context before first load
    const newConfig: Record<string, Record<string, string>> = {};
    filterRows.forEach(row => {
      if (row.table && row.field) {
        if (!newConfig[row.table]) newConfig[row.table] = {};
        let finalVal = row.value;
        if (["*", "="].includes(row.operator)) finalVal = row.operator;
        else finalVal = `${row.operator}${row.value}`;
        newConfig[row.table][row.field] = finalVal;
      }
    });
    const str = JSON.stringify(newConfig);
    if (str !== lastFilterSyncRef.current) {
      lastFilterSyncRef.current = str;
      dispatch({ type: "SYNC_FILTERS", payload: newConfig });
    }
  }, [filterRows, dispatch]);



  // --- HANDLERS ---
  const addDateRow = () => {
    setDateRows([...dateRows, { id: Math.random().toString(), table: "", field: "", operator: "...", value: "", startDate: "", endDate: "" }]);
  };
  const addFilterRow = () => {
    setFilterRows([...filterRows, { id: Math.random().toString(), table: "", field: "", operator: "==", value: "" }]);
  };
  const updateDateRow = (index: number, key: keyof FilterRow, val: string) => {
    const newRows = [...dateRows];
    newRows[index] = { ...newRows[index], [key]: val };
    setDateRows(newRows);
  };
  const updateFilterRow = (index: number, key: keyof FilterRow, val: string) => {
    const newRows = [...filterRows];
    newRows[index] = { ...newRows[index], [key]: val };
    setFilterRows(newRows);
  };

  return (
    <CollapsibleCard title="Report Filters" defaultOpen={false} icon={<SlidersHorizontal size={18} />}>
      
      {/* --- Date Range Fields --- */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-slate-700 text-sm">Date Range Fields</h3>
          <button onClick={addDateRow} className="btn-ghost-add">+ Add Date Range</button>
        </div>
        <div className="space-y-4">
          {dateRows.map((row, idx) => (
            <div key={row.id} className="border border-slate-200 rounded p-3 bg-slate-50">
              
              {/* Row 1: Selectors & Delete Button */}
              <div className="flex gap-3 mb-2 items-start">
                <div className="flex-1 flex gap-3">
                    <select 
                      className="form-input w-1/2" 
                      value={row.table} 
                      onChange={e => updateDateRow(idx, "table", e.target.value)}
                    >
                      <option value="">Select Table...</option>
                      {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select 
                      className="form-input w-1/2"
                      value={row.field} 
                      onChange={e => updateDateRow(idx, "field", e.target.value)}
                      disabled={!row.table}
                    >
                      <option value="">Select Date Field...</option>
                      {getFieldOptions(row.table , "date").filter(f => f.type === 'date').map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                </div>
                {/* Fixed width for delete button to prevent overlap */}
                <button 
                    onClick={() => setDateRows(dateRows.filter((_, i) => i !== idx))}
                    className="btn-danger-icon mt-0.5"
                  >
                    <X size={16} />
                </button>
              </div>

              {/* Row 2: Date Inputs */}
              <div className="flex gap-3">
                <div className="w-1/2">
                   <label className="text-[10px] uppercase text-slate-500 font-bold">Start Date</label>
                   <input 
                     type="date" 
                     className="form-input"
                     value={row.startDate}
                     onChange={e => updateDateRow(idx, "startDate", e.target.value)}
                   />
                </div>
                <div className="w-1/2">
                   <label className="text-[10px] uppercase text-slate-500 font-bold">End Date</label>
                   <input 
                     type="date" 
                     className="form-input"
                     value={row.endDate}
                     onChange={e => updateDateRow(idx, "endDate", e.target.value)}
                   />
                </div>
              </div>
            </div>
          ))}
          {dateRows.length === 0 && <div className="text-center text-slate-400 text-sm italic">No date ranges defined.</div>}
        </div>
      </div>

      {/* --- Standard Filters --- */}
      <div>
        <div className="flex justify-between items-center mb-3 pt-4 border-t border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">General Filters</h3>
          <button onClick={addFilterRow} className="btn-ghost-add">+ Add Filter</button>
        </div>
        <div className="space-y-2">
          {filterRows.map((row, idx) => (
            <div key={row.id} className="draggable-row">
                <select 
                  className="form-input w-1/4" 
                  value={row.table} 
                  onChange={e => updateFilterRow(idx, "table", e.target.value)}
                >
                  <option value="">Table...</option>
                  {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select 
                  className="form-input w-1/4" 
                  value={row.field} 
                  onChange={e => updateFilterRow(idx, "field", e.target.value)}
                  disabled={!row.table}
                >
                  <option value="">Field...</option>
                  {getFieldOptions(row.table , "date").map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select 
                   className="form-input w-1/4"
                   value={row.operator}
                   onChange={e => updateFilterRow(idx, "operator", e.target.value)}
                >
                  
                {FILTER_OPERATORS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                
                </select>
                <input 
                  type="text" 
                  className="form-input w-1/4"
                  placeholder="Value..."
                  value={row.value}
                  onChange={e => updateFilterRow(idx, "value", e.target.value)}
                  disabled={["*", "="].includes(row.operator)}
                />
                <button 
                  onClick={() => setFilterRows(filterRows.filter((_, i) => i !== idx))}
                  className="btn-danger-icon"
                >
                  <X size={16} />
                </button>
            </div>
          ))}
          {filterRows.length === 0 && <div className="text-center text-slate-400 text-sm italic">No filters defined.</div>}
        </div>
      </div>

    </CollapsibleCard>
  );
}
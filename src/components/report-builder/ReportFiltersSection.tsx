"use client";

import React, { useState, useEffect } from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import {FILTER_OPERATORS} from "@/constants/reportOptions";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Plus, X , SlidersHorizontal } from "lucide-react";

interface FilterRow {
  id: string;
  table: string;
  field: string;
  operator: string;
  value: string;
  startDate?: string;
  endDate?: string;
}

export function ReportFiltersSection() {
  const { state, dispatch } = useReport();
  const { getConnectedTables, getFieldOptions } = useSchema();

  const [dateRows, setDateRows] = useState<FilterRow[]>([]);
  const [filterRows, setFilterRows] = useState<FilterRow[]>([]);

  // 1. Load Initial State
  useEffect(() => {
    // ... (Keep existing loading logic same as before)
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
          startDate: start,
          endDate: end
        });
      });
    });
    if (loadedDates.length > 0) setDateRows(loadedDates);

    const loadedFilters: FilterRow[] = [];
    Object.entries(state.config.filters || {}).forEach(([table, fields]) => {
      Object.entries(fields).forEach(([field, rawValue]) => {
        let op = "==";
        let val = rawValue;
        if (rawValue === "*" || rawValue === "=") { op = rawValue; val = ""; }
        else if (rawValue.startsWith(">=")) { op = ">="; val = rawValue.substring(2); }
        else if (rawValue.startsWith("<=")) { op = "<="; val = rawValue.substring(2); }
        else if (rawValue.startsWith("==")) { op = "=="; val = rawValue.substring(2); }
        else if (rawValue.startsWith(">")) { op = ">"; val = rawValue.substring(1); }
        else if (rawValue.startsWith("<")) { op = "<"; val = rawValue.substring(1); }
        
        loadedFilters.push({
          id: Math.random().toString(36),
          table,
          field,
          operator: op,
          value: val
        });
      });
    });
    if (loadedFilters.length > 0) setFilterRows(loadedFilters);
  }, []); // Run once

  // 2. Sync State (Keep existing sync logic)
  useEffect(() => {
    const newConfig: Record<string, Record<string, string>> = {};
    dateRows.forEach(row => {
      if (row.table && row.field && row.startDate && row.endDate) {
        if (!newConfig[row.table]) newConfig[row.table] = {};
        newConfig[row.table][row.field] = `${row.startDate}...${row.endDate}`;
      }
    });
    dispatch({ type: "SYNC_DATE_RANGES", payload: newConfig });
  }, [dateRows, dispatch]);

  useEffect(() => {
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
    dispatch({ type: "SYNC_FILTERS", payload: newConfig });
  }, [filterRows, dispatch]);


  // Handlers
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
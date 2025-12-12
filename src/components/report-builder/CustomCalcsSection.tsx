"use client";

import "../../styles/reportConfig.css"
import React from "react";
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema"; 
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Plus, X } from "lucide-react";

export function CustomCalcsSection() {
  const { state, dispatch } = useReport();
  const calcs = state.config.custom_calculated_fields;

  // --- Helper: Get All Fields with UNIQUE KEYS ---
  const getDependencyOptions = () => {
    
    const options: { key: string; value: string; label: string }[] = [];
    
    // 1. Schema Fields
    if (state.setup?.tables) {
      Object.entries(state.setup.tables).forEach(([tableName, table]) => {
        Object.entries(table.fields).forEach(([fieldKey, fieldDef]) => {
          options.push({ 
            // FIX: Unique Key combination
            key: `${tableName}-${fieldKey}`, 
            value: fieldKey, 
            label: `${tableName} : ${fieldDef.label || fieldKey}` 
          });
        });
      });
    }

    // 2. Other Calculated Fields (chaining)
    calcs.forEach((c, idx) => {
      if (c.field_name) {
        options.push({ 
            key: `calc-${idx}-${c.field_name}`, // Unique Key
            value: c.field_name, 
            label: `(Calc) ${c.label || c.field_name}` 
        });
      }
    });

    return options;
  };
  
  const depOptions = getDependencyOptions();

  return (
    <CollapsibleCard 
      title="Custom Calculated Fields" 
      defaultOpen={false}
      action={
        <button 
          onClick={() => dispatch({ type: "ADD_CALC" })} 
          className="btn-primary btn-small"
        >
          <Plus size={16} /> Add
        </button>
      }
    >
      <div className="space-y-6">
        {calcs.map((calc, index) => (
          <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
              <h3 className="font-semibold text-slate-700">
                {calc.field_name || "(New Calculation)"}
              </h3>
              <button 
                onClick={() => dispatch({ type: "REMOVE_CALC", payload: index })}
                className="btn-danger-icon"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="form-label">Field Name (Internal)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ProfitMargin"
                  value={calc.field_name}
                  onChange={(e) => dispatch({ type: "UPDATE_CALC", payload: { index, field: "field_name", value: e.target.value } })}
                />
              </div>
              <div>
                <label className="form-label">Label (Display)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Profit Margin %"
                  value={calc.label}
                  onChange={(e) => dispatch({ type: "UPDATE_CALC", payload: { index, field: "label", value: e.target.value } })}
                />
              </div>
              <div>
                <label className="form-label">Format</label>
                <select
                  className="form-input"
                  value={calc.format}
                  onChange={(e) => dispatch({ type: "UPDATE_CALC", payload: { index, field: "format", value: e.target.value } })}
                >
                  <option value="number">Number</option>
                  <option value="currency">Currency ($)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
            </div>

            {/* Dependencies */}
            <div className="bg-white p-3 rounded border border-slate-200 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">Dependencies</span>
                <button
                   onClick={() => dispatch({ type: "ADD_CALC_DEP", payload: index })}
                   className="btn-ghost-add"
                >
                  + Add Dependency
                </button>
              </div>
              
              <div className="space-y-2">
                {calc.dependencies.map((dep, depIdx) => (
                  <div key={depIdx} className="flex gap-2 items-center">
                    <select
                      className="form-input"
                      value={dep}
                      onChange={(e) => dispatch({ 
                        type: "UPDATE_CALC_DEP", 
                        payload: { calcIndex: index, depIndex: depIdx, value: e.target.value } 
                      })}
                    >
                      <option value="">Select Field...</option>
                      {depOptions.map(opt => (
                        // FIX: Using the unique 'key' property here
                        <option key={opt.key} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => dispatch({ type: "REMOVE_CALC_DEP", payload: { calcIndex: index, depIndex: depIdx } })}
                      className="btn-danger-icon"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                 {calc.dependencies.length === 0 && (
                  <div className="text-xs text-slate-400 italic">No dependencies selected.</div>
                )}
              </div>
            </div>

            {/* Formula */}
            <div>
              <label className="form-label">Formula (Excel Style)</label>
              <textarea
                rows={2}
                className="form-input font-mono text-xs"
                placeholder="= (Price * Quantity) + Tax"
                value={calc.formula}
                onChange={(e) => dispatch({ type: "UPDATE_CALC", payload: { index, field: "formula", value: e.target.value } })}
              />
            </div>

          </div>
        ))}

        {calcs.length === 0 && (
          <div className="text-center text-slate-400 py-4 text-sm italic">
            No calculated fields added yet.
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
"use client";

import React from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { SchemaVisualizer } from "@/components/report-builder/SchemaVisualizer";
import { DbDefinition } from "@/lib/reportConfigTypes";

export function RelationshipsSection() {
  const { state, dispatch } = useReport();
  const { getAllTables, getFieldOptions } = useSchema();
  const rows = state.config.db_defination;

  const handleAddRow = () => {
    const newRow: DbDefinition = {
      primary_table: "",
      joined_table: "",
      join_type: "inner",
      fetch_order: rows.length + 1,
      source: "",
      target: ""
    };
    dispatch({ type: "ADD_DB_DEF", payload: newRow });
  };

  const handleUpdate = (index: number, field: keyof DbDefinition, value: any) => {
    dispatch({ type: "UPDATE_DB_DEF", payload: { index, field, value } });
  };

  return (
    <CollapsibleCard 
      title="Relationships Definition" 
      defaultOpen={true}
      action={
        <button 
          onClick={(e) => { e.stopPropagation(); handleAddRow(); }} 
          className="btn-primary btn-small"
        >
          <span>+</span> Add Join
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr>
              <th className="table-header">Primary Table</th>
              <th className="table-header">Joined Table</th>
              <th className="table-header">Source Field</th>
              <th className="table-header">Target Field</th>
              <th className="table-header">Join Type</th>
              <th className="table-header w-20">Order</th>
              <th className="table-header w-16">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50/50">
                <td className="table-cell">
                  <select
                    value={row.primary_table}
                    onChange={(e) => handleUpdate(index, "primary_table", e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getAllTables().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="table-cell">
                  <select
                    value={row.joined_table}
                    onChange={(e) => handleUpdate(index, "joined_table", e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getAllTables().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="table-cell">
                  <select
                    value={row.source}
                    onChange={(e) => handleUpdate(index, "source", e.target.value)}
                    disabled={!row.primary_table}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getFieldOptions(row.primary_table).map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
                <td className="table-cell">
                  <select
                    value={row.target}
                    onChange={(e) => handleUpdate(index, "target", e.target.value)}
                    disabled={!row.joined_table}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getFieldOptions(row.joined_table).map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
                <td className="table-cell">
                  <select
                    value={row.join_type}
                    onChange={(e) => handleUpdate(index, "join_type", e.target.value)}
                    className="form-input"
                  >
                    <option value="inner">Inner Join</option>
                    <option value="left">Left Join</option>
                    <option value="right">Right Join</option>
                  </select>
                </td>
                <td className="table-cell">
                  <input
                    type="number"
                    value={row.fetch_order}
                    onChange={(e) => handleUpdate(index, "fetch_order", parseInt(e.target.value))}
                    className="form-input"
                  />
                </td>
                <td className="table-cell text-center">
                  <button
                    onClick={() => dispatch({ type: "REMOVE_DB_DEF", payload: index })}
                    className="btn-danger-icon"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400 italic bg-slate-50/50">
                  No relationships defined. Click "+ Add Join" to start.
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>

      <div className="mt-6" >
      <SchemaVisualizer/>
      </div>

    </CollapsibleCard>
  );
}
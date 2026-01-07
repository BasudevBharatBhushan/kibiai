
import "@/styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import {JOIN_TYPES} from "@/constants/reportOptions";
import { SchemaVisualizer } from "./SchemaVisualizer";
import { DbDefinition } from "@/lib/types/reportConfigTypes";
import { Link2, Trash2 , Plus} from "lucide-react";

export function RelationshipsSection() {
  // --- CONTEXT & HOOKS ---
  const { state, dispatch } = useReport();
  const { getAllTables, getFieldOptions } = useSchema();
  const rows = state.config.db_defination;

  // Handlers
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
      defaultOpen={false}
      icon={<Link2 size={18} />}
      action={
        <button 
          onClick={(e) => { e.stopPropagation(); handleAddRow(); }} 
          className="btn-primary btn-small"
        >
          <Plus size={16} /> Join
        </button>
      }
    >
      <div className="overflow-x-auto mb-6 border rounded-lg border-slate-200">
        {/* Relationships Table */}
        <table className="w-full text-sm text-left">
          {/* Table Header */}
          <thead>
            <tr>
              <th className="table-header min-w-[160px]">Primary Table</th>
              <th className="table-header min-w-[160px]">Joined Table</th>
              <th className="table-header min-w-[160px]">Source Field</th>
              <th className="table-header min-w-[160px]">Target Field</th>
              <th className="table-header min-w-[160px]">Join Type</th>
              <th className="table-header min-w-[100px]">Action</th>
            </tr>
          </thead>
          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-slate-50/50">
                {/* Primary table select */}
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
                {/* Joined table select */}
                <td className="table-cell">
                  <select
                    value={row.joined_table}
                    onChange={(e) => handleUpdate(index, "joined_table", e.target.value)}
                    disabled={row.fetch_order === 1}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getAllTables().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                {/* Source field select */}
                <td className="table-cell">
                  <select
                    value={row.source}
                    onChange={(e) => handleUpdate(index, "source", e.target.value)}
                    disabled={!row.primary_table || row.fetch_order === 1}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {getFieldOptions(row.primary_table).map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </td>
                {/* Target field select */}
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
                {/* Join type select */}
                <td className="table-cell">
                  <select
                    value={row.join_type}
                    onChange={(e) => handleUpdate(index, "join_type", e.target.value)}
                    className="form-input"
                  >

                  {JOIN_TYPES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                  
                  </select>
                </td>
                <td className="table-cell text-center">
                  <button
                    onClick={() => dispatch({ type: "REMOVE_DB_DEF", payload: index })}
                    className="btn-danger-icon"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}

            {/* Show message if no rows */}
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
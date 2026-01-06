"use client";

import React from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import {SORT_ORDERS} from "@/constants/reportOptions";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard"; 
import { Plus, X, GripVertical, ArrowUpDown , NotebookTabs, TableIcon} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

export function ReportBodySection() {
  const { state, dispatch } = useReport();
  const { getConnectedTables, getFieldOptions } = useSchema();
  
  const columns = state.config.report_columns;
  const sortOrders = state.config.body_sort_order;

  // --- Helper: Get Fields with Unique Keys for Dropdown ---
  const getAllFields = () => {
    const allFields: { key: string; value: string; label: string }[] = [];
    if (state.setup?.tables) {
      Object.entries(state.setup.tables).forEach(([tableName, def]) => {
        Object.keys(def.fields).forEach((field) => {
          allFields.push({
            key: `${tableName}-${field}`, 
            value: field, 
            label: `${tableName} : ${def.fields[field].label || field}`
          });
        });
      });
    }
    return allFields;
  };
  const allFieldOptions = getAllFields();

  // --- Drag & Drop Handlers ---
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    if (result.type === "COLUMNS") {
      dispatch({
        type: "REORDER_COLUMNS",
        payload: {
          sourceIndex: result.source.index,
          destinationIndex: result.destination.index
        }
      });
    } else if (result.type === "SORTS") {
      dispatch({
        type: "REORDER_BODY_SORTS",
        payload: {
          sourceIndex: result.source.index,
          destinationIndex: result.destination.index
        }
      });
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <CollapsibleCard title="Report Body" defaultOpen={false} icon={<TableIcon size={18}/>}>

        {/* --- Section 1: Report Columns --- */}
        <div className="mb-8">

          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2 ">
              <NotebookTabs size={14} /> Report Columns
            </h3>
            <button 
              onClick={() => dispatch({ type: "ADD_COLUMN" })} 
              className="btn-ghost-add inline-flex items-center gap-2"
            >
              <Plus size={14} />
              <span>Add Column</span>
            </button>
          </div>

          <div className="text-indigo-400 text-sm italic mt-5 mb-5">
            The column arrangement decides the order of columns in the report.
          </div>

          <Droppable droppableId="columns-list" type="COLUMNS">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef} 
                className="space-y-2"
              >
                {columns.map((col, index) => (
                  <Draggable key={`col-${index}`} draggableId={`col-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`draggable-row ${
                          snapshot.isDragging 
                            ? "draggable-row-active" 
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div {...provided.dragHandleProps} className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                          <GripVertical size={16} />
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <select
                            className="form-input"
                            value={col.table}
                            onChange={(e) => dispatch({ type: "UPDATE_COLUMN", payload: { index, field: "table", value: e.target.value } })}
                          >
                            <option value="">Select Table...</option>
                            {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                            <option value="calculated">Calculated Fields</option>
                          </select>

                          <select
                            className="form-input"
                            value={col.field}
                            onChange={(e) => dispatch({ type: "UPDATE_COLUMN", payload: { index, field: "field", value: e.target.value } })}
                            disabled={!col.table}
                          >
                            <option value="">Select Field...</option>
                            {getFieldOptions(col.table).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>

                        <button 
                          onClick={() => dispatch({ type: "REMOVE_COLUMN", payload: index })} 
                          className="btn-danger-icon"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          
          {columns.length === 0 && (
            <div className="text-slate-400 text-sm italic text-center py-2">
              No columns added. The report will be empty.
            </div>
          )}
        </div>

        {/* --- Section 2: Body Sort Order --- */}
        <div>
            <div className="flex justify-between items-center mb-3 border-t border-slate-100 pt-4">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <ArrowUpDown size={14} /> Sort Order
              </h3>
              <button 
                onClick={() => dispatch({ type: "ADD_BODY_SORT" })} 
                className="btn-ghost-add inline-flex items-center gap-2"
              >
                <Plus size={14} />
                <span>Add Sort</span>
              </button>
            </div>

            <div className="text-indigo-400 text-sm italic mt-5 mb-5">
            The sort order decides the nested sorting of records within each section.
            </div>

          <Droppable droppableId="sorts-list" type="SORTS">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-2"
              >
                {sortOrders.map((sort, index) => (
                  <Draggable key={`sort-${index}`} draggableId={`sort-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex gap-3 items-center p-2 rounded border transition-colors ${
                          snapshot.isDragging 
                            ? "bg-indigo-50 border-indigo-300 shadow-lg z-50" 
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div {...provided.dragHandleProps} className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                          <GripVertical size={16} />
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <select
                            className="form-input"
                            value={sort.field}
                            onChange={(e) => dispatch({ type: "UPDATE_BODY_SORT", payload: { index, field: "field", value: e.target.value } })}
                          >
                            <option value="">Select Field...</option>
                            {allFieldOptions.map(f => (
                              <option key={f.key} value={f.value}>{f.label}</option>
                            ))}
                          </select>

                          <select
                            className="form-input"
                            value={sort.sort_order}
                            onChange={(e) => dispatch({ type: "UPDATE_BODY_SORT", payload: { index, field: "sort_order", value: e.target.value } })}
                          >

                          {SORT_ORDERS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}

                          </select>
                        </div>

                        <button 
                          onClick={() => dispatch({ type: "REMOVE_BODY_SORT", payload: index })} 
                          className="btn-danger-icon"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {sortOrders.length === 0 && (
            <div className="text-slate-400 text-sm italic text-center py-2">
              No sorting applied.
            </div>
          )}
        </div>

      </CollapsibleCard>
    </DragDropContext>
  );
}
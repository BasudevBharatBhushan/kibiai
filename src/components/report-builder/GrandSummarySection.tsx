"use client";

import React from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Plus, X, GripVertical , Newspaper, Sigma } from "lucide-react";
import { useSchema } from "@/lib/hooks/useSchema";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";


export function GrandSummarySection() {
  const { state, dispatch } = useReport();
  const summaryFields = state.config.summary_fields;
  const { getFieldOptions } = useSchema();
  
  const calcs = state.config.custom_calculated_fields || [];


  // Helper: Get ONLY Number fields that are actually in the report
  // (body columns + all custom calcs). This ensures that option values
  // exactly match what summary_fields stores (raw field names), preventing
  // blank selects when loading a saved config.
  const getNumberOptions = () => {
    const options: { key: string; value: string; label: string }[] = [];

    (state.config.report_columns || []).forEach((col, idx) => {
      if (!col.table || !col.field) return;
      
      if (col.table === "calculated") {
        const c = calcs.find((calc) => calc.field_name === col.field);
        options.push({
          key: `calc-${idx}-${col.field}`,
          value: col.field,
          label: `(Calc) ${c?.label || col.field}`,
        });
      } else {
        const allFields = getFieldOptions(col.table);
        const match = allFields.find((f) => f.value === col.field);
        options.push({
          key: `${col.table}-${idx}-${col.field}`,
          value: col.field,
          label: `${col.table} : ${match ? match.label : col.field}`,
        });
      }
    });

    return options;
  };
  
  const numberOptions = getNumberOptions();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    dispatch({
      type: "REORDER_SUMMARY_FIELDS",
      payload: {
        sourceIndex: result.source.index,
        destinationIndex: result.destination.index
      }
    });
  };

  return (
    <CollapsibleCard 
      title="Report Grand-Summary" 
      defaultOpen={false}
      icon={<Sigma size={18}/>}
      action={
        <button 
           onClick={(e) => { e.stopPropagation(); dispatch({ type: "ADD_SUMMARY_FIELD" }); }}
           className="btn-primary btn-small"
        >
          <Plus size={16} /> Add
        </button>
      }
    >
       <DragDropContext onDragEnd={onDragEnd}>
         <Droppable droppableId="summary-list">
           {(provided) => (
             <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {summaryFields.map((field, index) => (
                  <Draggable key={`sum-${index}`} draggableId={`sum-${index}`} index={index}>
                    {(provided, snapshot) => (
                       <div
                         ref={provided.innerRef}
                         {...provided.draggableProps}
                         className={`draggable-row ${
                            snapshot.isDragging ? "draggable-row-active" : "bg-slate-50 border-slate-200"
                         }`}
                       >
                          <div {...provided.dragHandleProps} className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                            <GripVertical size={16} />
                          </div>
                          
                          <select 
                             className="form-input flex-1"
                             value={field}
                             onChange={(e) => dispatch({ type: "UPDATE_SUMMARY_FIELD", payload: { index, value: e.target.value } })}
                          >
                             <option value="">Select Number Field...</option>
                             {numberOptions.map(opt => (
                                <option key={opt.key} value={opt.value}>{opt.label}</option>
                             ))}
                          </select>

                          <button 
                             onClick={() => dispatch({ type: "REMOVE_SUMMARY_FIELD", payload: index })}
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
         {summaryFields.length === 0 && (
             <div className="text-center text-slate-400 py-4 text-sm italic">
                No summary fields added.
             </div>
         )}
       </DragDropContext>
    </CollapsibleCard>
  );
}
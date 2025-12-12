"use client";

import React, { useState } from "react";
import "../../styles/reportConfig.css"
import { useReport } from "@/context/ReportContext";
import { useSchema } from "@/lib/hooks/useSchema";
import { Modal } from "@/components/ui/Modal";
import { Plus, X, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard"; 

export function SubSummarySection() {
  const { state, dispatch } = useReport();
  const { getConnectedTables, getFieldOptions } = useSchema();
  const groups = state.config.group_by_fields;
  
  const groupEntries = Object.entries(groups);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleOpenModal = () => {
    setNewGroupName("");
    setIsModalOpen(true);
  };

  const handleConfirmAdd = () => {
    if (newGroupName.trim()) {
      dispatch({ type: "ADD_GROUP", payload: newGroupName.trim() });
      setIsModalOpen(false);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    dispatch({
      type: "REORDER_GROUPS",
      payload: {
        sourceIndex: result.source.index,
        destinationIndex: result.destination.index
      }
    });
  };

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <CollapsibleCard 
          title="Report Sub-Summary(s)"
          defaultOpen={false}
          action={
            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(); }} className="btn-primary btn-small">
              <Plus size={16} /> Add
            </button>
          }
        >
          <Droppable droppableId="sub-summary-list">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef} 
                className="space-y-6"
              >
                {groupEntries.map(([key, group], index) => (
                  <Draggable key={key} draggableId={key} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`border border-slate-200 rounded-lg p-4 transition-colors ${
                          snapshot.isDragging ? "draggable-row-active" : "bg-slate-50"
                        }`}
                      >
                        {/* Group Header */}
                        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                             <div 
                               {...provided.dragHandleProps} 
                               className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1"
                             >
                               <GripVertical size={18} />
                             </div>
                             <h3 className="font-semibold text-slate-700">{key}</h3>
                          </div>
                          
                          <button
                            onClick={() => dispatch({ type: "REMOVE_GROUP", payload: key })}
                            className="btn-danger-icon"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* Main Group Config */}
                        <div className="input-grid-3 pl-8 mb-5">
                          <div className="mb-2">
                            <label className="form-label">Table</label>
                            <select
                              className="form-input"
                              value={group.table}
                              onChange={(e) => dispatch({ type: "UPDATE_GROUP_MAIN", payload: { groupKey: key, field: "table", value: e.target.value } })}
                            >
                              <option value="">Select Table...</option>
                              {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                              <option value="calculated">Calculated Fields</option>
                            </select>
                          </div>
                          <div className="mb-2">
                            <label className="form-label">Field</label>
                            <select
                              className="form-input"
                              value={group.field}
                              onChange={(e) => dispatch({ type: "UPDATE_GROUP_MAIN", payload: { groupKey: key, field: "field", value: e.target.value } })}
                              disabled={!group.table}
                            >
                              <option value="">Select Field...</option>
                              {getFieldOptions(group.table).map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Sort Order</label>
                            <select
                              className="form-input"
                              value={group.sort_order}
                              onChange={(e) => dispatch({ type: "UPDATE_GROUP_MAIN", payload: { groupKey: key, field: "sort_order", value: e.target.value } })}
                            >
                              <option value="asc">Ascending</option>
                              <option value="desc">Descending</option>
                            </select>
                          </div>
                        </div>

                        {/* Nested: Display Fields */}
                        <div className="nested-section">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-600">Display Fields</span>
                            <button
                               onClick={() => dispatch({ type: "ADD_GROUP_DISPLAY", payload: key })}
                               className="btn-ghost-add"
                            >
                              + Add Display Field
                            </button>
                          </div>
                          {group.display.map((item, idx) => (
                            <div key={idx} className="flex gap-2 mb-2 items-center">
                              <select 
                                 className="form-input w-1/2"
                                 value={item.table}
                                 onChange={(e) => dispatch({ type: "UPDATE_GROUP_DISPLAY", payload: { groupKey: key, index: idx, field: "table", value: e.target.value } })}
                              >
                                <option value="">Table...</option>
                                {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <select 
                                 className="form-input w-1/2"
                                 value={item.field}
                                 onChange={(e) => dispatch({ type: "UPDATE_GROUP_DISPLAY", payload: { groupKey: key, index: idx, field: "field", value: e.target.value } })}
                                 disabled={!item.table}
                              >
                                 <option value="">Field...</option>
                                 {getFieldOptions(item.table , "number").map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <button onClick={() => dispatch({ type: "REMOVE_GROUP_DISPLAY", payload: { groupKey: key, index: idx } })} className="btn-danger-icon">
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Nested: Group Total Fields */}
                        <div className="bg-white p-3 rounded border border-slate-200 ml-8">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-slate-600">Group Total Fields</span>
                            <button
                               onClick={() => dispatch({ type: "ADD_GROUP_TOTAL", payload: key })}
                               className="btn-ghost-add"
                            >
                              + Add Total Field
                            </button>
                          </div>
                          {group.group_total.map((item, idx) => (
                            <div key={idx} className="flex gap-2 mb-2 items-center">
                               <select 
                                 className="form-input w-1/2"
                                 value={item.table}
                                 onChange={(e) => dispatch({ type: "UPDATE_GROUP_TOTAL", payload: { groupKey: key, index: idx, field: "table", value: e.target.value } })}
                              >
                                <option value="">Table...</option>
                                {getConnectedTables().map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <select 
                                 className="form-input w-1/2"
                                 value={item.field}
                                 onChange={(e) => dispatch({ type: "UPDATE_GROUP_TOTAL", payload: { groupKey: key, index: idx, field: "field", value: e.target.value } })}
                                 disabled={!item.table}
                              >
                                 <option value="">Field...</option>
                                 {getFieldOptions(item.table , "number").map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                              <button onClick={() => dispatch({ type: "REMOVE_GROUP_TOTAL", payload: { groupKey: key, index: idx } })} className="btn-danger-icon">
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
          
          {groupEntries.length === 0 && (
              <div className="text-center text-slate-400 py-4 text-sm italic">
                  No sub-summaries added yet. Click "Add" above.
              </div>
          )}
        </CollapsibleCard>

        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Add Sub-Summary Group"
        >
          {/* ... Modal content same as before ... */}
          <div className="space-y-4">
            <div>
              <label className="form-label">Group Name</label>
              <input 
                autoFocus
                type="text" 
                className="form-input"
                placeholder="e.g. Sales by Region"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmAdd()}
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmAdd}
                disabled={!newGroupName.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </div>
        </Modal>
      </DragDropContext>
    </>
  );
}
"use client";

import React, { useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  Node, 
  Edge
} from 'reactflow';
import { Maximize, Minimize, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import 'reactflow/dist/style.css';
import "../../styles/reportConfig.css"
import { useReport } from '@/context/ReportContext';
import TableNode from './diagram/TableNode';
import { Card, CardHeader } from '@/components/ui/Card';

const nodeTypes = { table: TableNode };

export function SchemaVisualizer() {
  const { state } = useReport();
  const { db_defination } = state.config;
  const setupTables = state.setup?.tables; // Pass the raw value (can be undefined)

  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false); 

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-Layout Logic
  useEffect(() => {
    // Safety check: If no definition, clear and return
    if (!db_defination || db_defination.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const uniqueTables = new Set<string>();
    
    // 1. Identify Tables
    db_defination.forEach(def => {
        if (def.primary_table) uniqueTables.add(def.primary_table);
        if (def.joined_table) uniqueTables.add(def.joined_table);
    });

    // 2. Create Nodes
    Array.from(uniqueTables).forEach((tableName, index) => {
        // Safe access inside the effect
        const tableDef = setupTables ? setupTables[tableName] : null;
        const fields = tableDef ? Object.keys(tableDef.fields) : [];

        newNodes.push({
            id: tableName,
            type: 'table',
            position: { x: index * 300, y: 50 + (index % 2) * 50 }, 
            data: { 
                label: tableName, 
                fields: fields.slice(0, 8), 
                isPrimary: index === 0 
            }
        });
    });

    // 3. Create Edges
    db_defination.forEach((def, index) => {
        if (def.primary_table && def.joined_table) {
            newEdges.push({
                id: `e-${index}`,
                source: def.primary_table,
                target: def.joined_table,
                label: def.join_type,
                animated: true,
                style: { stroke: '#4f46e5' }, 
                markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
            });
        }
    });

    setNodes(newNodes);
    setEdges(newEdges);

  // FIX: Only depend on setupTables (stable from context) and db_defination
  }, [db_defination, setupTables, setNodes, setEdges]);


  // 3. Define the Modal Content
  const expandedModalContent = (
    <div 
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setIsExpanded(false)}
    >
        <div 
            className="bg-white w-[80vw] h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
        >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white z-10">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Maximize size={20} className="text-indigo-600" />
                    Relationship Visual Schema
                </h2>
                <button 
                    onClick={() => setIsExpanded(false)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors font-medium text-sm"
                >
                    <X size={18} /> Close
                </button>
            </div>

            <div className="flex-1 bg-slate-50 relative overflow-hidden">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.1}
                    maxZoom={2}
                >
                    <Background color="#cbd5e1" gap={20} size={1} />
                    <Controls />
                </ReactFlow>
            </div>
        </div>
    </div>
  );

return (
    <>
      {/* --- STANDARD CARD VIEW --- */}
      <Card className="h-[500px] flex flex-col relative">
          <div className="card-header-wrapper">
            <h2 className="card-title">
                Relationship Visual Schema
            </h2>
            {/* Expand Button */}
            <button 
                onClick={() => setIsExpanded(true)}
                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600 transition-colors"
                title="Expand View"
            >
                <Maximize size={18} />
            </button>
          </div>

          <div className="flex-1 bg-slate-50 border-t border-slate-100 overflow-hidden relative">
              <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                  attributionPosition="bottom-right"
              >
                  <Background color="#e2e8f0" gap={16} />
                  <Controls className="bg-white border-slate-200 shadow-sm" />
              </ReactFlow>
          </div>
      </Card>

    {/* --- EXPANDED POP-UP MODAL --- */}
    {/* Use createPortal to move this div to document.body */}
      {isExpanded && mounted && createPortal(
        expandedModalContent,
        document.body
      )}
    </>
  );
}
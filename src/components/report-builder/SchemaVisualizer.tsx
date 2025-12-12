"use client";

import React, { useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  Node, 
  Edge
} from 'reactflow';
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

  return (
    <Card className="h-[500px] flex flex-col">
        <CardHeader title="Visual Schema" />
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#e2e8f0" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    </Card>
  );
}
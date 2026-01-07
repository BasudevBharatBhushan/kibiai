import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import "@/styles/reportConfig.css"

// This defines the data we pass to each node
interface TableNodeData {
  label: string;
  fields: string[];
  isPrimary?: boolean;
}

const TableNode = ({ data }: { data: TableNodeData }) => {
  return (
    <div className={`shadow-md rounded-md bg-white border-2 min-w-[200px] ${data.isPrimary ? 'border-indigo-500' : 'border-slate-300'}`}>
      
      {/* 1. Header (Table Name) */}
      <div className={`p-2 font-bold text-sm border-b ${data.isPrimary ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        {data.label}
      </div>

      {/* 2. Field List */}
      <div className="p-2 space-y-1">
        {data.fields.map((field, index) => (
            <div key={index} className="text-xs text-slate-600 font-mono flex items-center justify-between px-1 hover:bg-slate-50 rounded">
                <span>{field}</span>
                {/* Connectors (Handles) for every field to allow precise joins later if needed */}
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    id={field} 
                    className="!w-2 !h-2 !bg-slate-300" 
                    style={{ right: -14 }}
                />
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    id={field} 
                    className="!w-2 !h-2 !bg-slate-300" 
                    style={{ left: -14 }}
                />
            </div>
        ))}
      </div>
    </div>
  );
};

export default memo(TableNode);
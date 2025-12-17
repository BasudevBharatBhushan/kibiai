'use client';

import React, { useState } from 'react';
import { 
  FiX, FiPlus, FiMinusCircle, FiBarChart2, FiPieChart, 
  FiActivity, FiChevronDown, FiChevronRight, FiCpu, FiTrendingUp, FiList
} from 'react-icons/fi';
import { MdOutlineDonutLarge } from 'react-icons/md';
import { ChartConfig, ChartKind } from '@/lib/ChartTypes';

interface EditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeCharts: ChartConfig[];
  inactiveCharts: ChartConfig[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onChangeKind: (id: string, kind: ChartKind) => void;
}

export default function EditPanel({
  isOpen,
  onClose,
  activeCharts,
  inactiveCharts,
  onAdd,
  onRemove,
  onChangeKind
}: EditPanelProps) {

  const [isActiveOpen, setIsActiveOpen] = useState(true);
  const [isInactiveOpen, setIsInactiveOpen] = useState(false);

  // Helper to get icon for chart kind
  const getIcon = (kind: ChartKind) => {
    switch (kind) {
      case 'pie': return <FiPieChart />;
      case 'donut': return <MdOutlineDonutLarge />;
      case 'line': return <FiActivity />;
      case 'area': return <FiActivity />;
      default: return <FiBarChart2 />;
    }
  };

  return (
    <>
      {/* Overlay Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        
        {/* --- HEADER --- */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Configuration</h2>
            <p className="text-sm text-slate-500">Manage dashboard charts</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 1. ACTIVE CHARTS ACCORDION */}
          <div className="space-y-2">
            <button 
              onClick={() => setIsActiveOpen(!isActiveOpen)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-200 transition-colors">
                   <FiBarChart2 size={24} />
                </div>
                <div>
                   <span className="block font-semibold text-slate-800 text-base">Active Charts</span>
                   <span className="text-sm text-slate-500">{activeCharts.length} visible</span>
                </div>
              </div>

              {isActiveOpen ? 
                <FiChevronDown className="text-slate-400 group-hover:text-slate-600 h-5 w-5" /> : 
                <FiChevronRight className="text-slate-400 group-hover:text-slate-600 h-5 w-5" />
              }
            </button>
            
            {/* Expanded Content */}
            {isActiveOpen && (
              <div className="space-y-3 pt-1 pl-1 pr-1 animate-in slide-in-from-top-2 duration-200">
                {activeCharts.length === 0 && (
                  <p className="text-sm text-slate-400 italic text-center py-2">No active charts.</p>
                )}
                {activeCharts.map(chart => (
                  <div key={chart.id} className="p-3 border border-slate-100 rounded-lg shadow-sm bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                          {getIcon(chart.kind)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 line-clamp-1" title={chart.title}>
                          {chart.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => onRemove(chart.id)}
                        className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <FiMinusCircle /> Remove
                      </button>
                    </div>

                    {/* Chart Type Selector */}
                    {chart.kind !== 'insight' && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {(['column', 'line', 'area', 'pie', 'donut'] as ChartKind[]).map(k => (
                          <button
                            key={k}
                            onClick={() => onChangeKind(chart.id, k)}
                            className={`
                              flex flex-col items-center justify-center py-2 px-1 rounded text-xs gap-1 border transition-all
                              ${chart.kind === k 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-white'}
                            `}
                          >
                            {getIcon(k)}
                            <span className="capitalize">{k === 'column' ? 'bar' : k}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. INACTIVE CHARTS ACCORDION */}
          <div className="space-y-2">
            <button 
              onClick={() => setIsInactiveOpen(!isInactiveOpen)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl group-hover:bg-slate-200 transition-colors">
                   <FiList size={24} />
                </div>
                <div>
                   <span className="block font-semibold text-slate-800 text-base">Inactive Charts</span>
                   <span className="text-sm text-slate-500">{inactiveCharts.length} hidden</span>
                </div>
              </div>

              {isInactiveOpen ? 
                <FiChevronDown className="text-slate-400 group-hover:text-slate-600 h-5 w-5" /> : 
                <FiChevronRight className="text-slate-400 group-hover:text-slate-600 h-5 w-5" />
              }
            </button>
            
            {/* Expanded Content */}
            {isInactiveOpen && (
              <div className="space-y-2 pt-1 pl-1 pr-1 animate-in slide-in-from-top-2 duration-200">
                 {inactiveCharts.length === 0 && (
                  <p className="text-sm text-slate-400 italic text-center py-2">All charts are active.</p>
                )}
                {inactiveCharts.map(chart => (
                  <div key={chart.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                    <span className="text-sm text-slate-600 line-clamp-1">{chart.title}</span>
                    <button 
                      onClick={() => onAdd(chart.id)}
                      className="p-1.5 bg-white border border-slate-200 text-green-600 rounded hover:bg-green-50 hover:border-green-200 transition-all shadow-sm"
                      title="Add to Dashboard"
                    >
                      <FiPlus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. NEW ACTION BUTTONS */}
          <div className="pt-2 space-y-3">
             <button 
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50 transition-all group text-left"
                onClick={() => alert("Coming soon: AI Chart Generation")}
             >
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 flex items-center justify-center bg-purple-100 text-purple-600 rounded-xl group-hover:bg-purple-200 transition-colors">
                      <FiCpu size={24} />
                   </div>
                   <div>
                      <span className="block font-bold text-slate-800 text-base group-hover:text-purple-700">Add Charts using AI</span>
                      <span className="text-sm text-slate-500 group-hover:text-purple-600/80">Auto-generate from data</span>
                   </div>
                </div>
                <FiChevronRight className="text-slate-300 group-hover:text-purple-400 h-5 w-5" />
             </button>

             <button 
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200 hover:bg-indigo-50 transition-all group text-left"
                onClick={() => alert("Coming soon: Business Insights")}
             >
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-xl group-hover:bg-indigo-200 transition-colors">
                      <FiTrendingUp size={24} />
                   </div>
                   <div>
                      <span className="block font-bold text-slate-800 text-base group-hover:text-indigo-700">Generate Business Insight</span>
                      <span className="text-sm text-slate-500 group-hover:text-indigo-600/80">Analyze current trends</span>
                   </div>
                </div>
                <FiChevronRight className="text-slate-300 group-hover:text-indigo-400 h-5 w-5" />
             </button>
          </div>

        </div>

        {/* --- FOOTER --- */}
        <div className="p-5 border-t border-slate-100 bg-slate-50">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
          >
            Done
          </button>
        </div>

      </div>
    </>
  );
}
'use client';

import React from 'react';
import { 
  FiX, FiSettings, FiBarChart2, FiPlus, FiMinusCircle,
  FiPieChart, FiActivity, FiDisc, FiTrendingUp, FiAlignLeft, FiColumns 
} from 'react-icons/fi';
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
  isOpen, onClose, activeCharts, inactiveCharts, onAdd, onRemove, onChangeKind 
}: EditPanelProps) {
  
  // Define the available options with Icons
  const CHART_OPTIONS: { value: ChartKind; label: string; icon: React.ReactNode }[] = [
    { value: 'column', label: 'Column', icon: <FiBarChart2 className="rotate-90" /> }, // Rotate for column look
    { value: 'line', label: 'Line', icon: <FiActivity /> },
    { value: 'area', label: 'Area', icon: <FiTrendingUp /> },
    { value: 'pie', label: 'Pie', icon: <FiPieChart /> },
    { value: 'donut', label: 'Donut', icon: <FiDisc /> },
  ];

  // Helper to get icon for inactive list
  const getChartIcon = (kind: ChartKind) => {
    const opt = CHART_OPTIONS.find(o => o.value === kind);
    return opt ? opt.icon : <FiBarChart2 />;
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><FiSettings size={20} /></div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">Configuration</h2>
              <p className="text-xs text-slate-500">Manage dashboard charts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><FiX size={20} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/30">
          
          {/* SECTION 1: ACTIVE CHARTS (Redesigned) */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
              Active on Dashboard ({activeCharts.length})
            </p>
            <div className="space-y-4">
              {activeCharts.map((chart) => (
                <div key={chart.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  
                  {/* Top Row: Title + Remove */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       {/* Current Icon Badge */}
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                        {chart.kind === 'insight' ? <FiAlignLeft size={14} /> : getChartIcon(chart.kind)}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]" title={chart.title}>
                        {chart.title}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => onRemove(chart.id)}
                      className="text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <FiMinusCircle size={12} /> Remove
                    </button>
                  </div>

                  {/* Bottom Row: Selector Buttons */}
                  {chart.kind !== 'insight' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {CHART_OPTIONS.map((opt) => {
                        const isActive = chart.kind === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => onChangeKind(chart.id, opt.value)}
                            className={`
                              flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-[10px] font-medium transition-all
                              ${isActive 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-white hover:border-blue-200 hover:text-blue-500'
                              }
                            `}
                          >
                            <span className="mb-1 text-base">{opt.icon}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500 italic text-center">
                      Text-based Insight Card
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>


          {/* SECTION 2: INACTIVE CHARTS (Kept Compact) */}
          {inactiveCharts.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                Inactive / Hidden ({inactiveCharts.length})
              </p>
              <div className="space-y-2">
                {inactiveCharts.map((chart) => (
                  <div key={chart.id} className="p-2 bg-slate-50/50 border border-slate-200 border-dashed rounded-lg flex items-center justify-between group hover:bg-white hover:border-blue-300 transition-all">
                    <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                      <div className="p-1.5 bg-white border border-slate-200 rounded text-slate-400">
                        {getChartIcon(chart.kind)}
                      </div>
                      <span className="text-xs font-medium text-slate-600">{chart.title}</span>
                    </div>
                    <button 
                      onClick={() => onAdd(chart.id)}
                      className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                      title="Restore"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        <div className="p-4 border-t border-slate-100 bg-white">
          <button 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 text-slate-600 font-medium rounded-lg hover:bg-slate-200 transition-colors">
            Done
          </button>
        </div>
      </div>
    </>
  );
}
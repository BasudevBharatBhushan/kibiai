'use client';

import React, { useState } from 'react';
import { 
  FiX, FiPlus, FiMinusCircle, FiBarChart2, FiPieChart, 
  FiActivity, FiChevronDown, FiChevronRight, FiCpu, FiTrendingUp, FiList
} from 'react-icons/fi';
import { MdOutlineDonutLarge } from 'react-icons/md';

import { useDashboard } from '@/context/DashboardContext';
import { ChartKind } from '@/lib/charts/ChartTypes';
import { AVAILABLE_CHART_TYPES, UI_TEXT } from '@/constants/dashboard';

// EditPanel Component
export default function EditPanel() {
  const { 
    isEditOpen, 
    setEditOpen, 
    activeCharts, 
    inactiveCharts, 
    addChart, 
    removeChart, 
    updateChartKind,
    deleteAllCharts
  } = useDashboard();

  const [isActiveOpen, setIsActiveOpen] = useState(true);
  const [isInactiveOpen, setIsInactiveOpen] = useState(false);

  const getIcon = (kind: ChartKind) => {
    switch (kind) {
      case 'pie': return <FiPieChart />;
      case 'donut': return <MdOutlineDonutLarge />;
      case 'line': return <FiActivity />;
      case 'area': return <FiActivity />;
      default: return <FiBarChart2 />;
    }
  };

  // Render
  return (
    <div className="h-full w-full bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Configuration</h2>
          <p className="text-sm text-slate-500">Manage dashboard charts</p>
        </div>
        <button 
          onClick={() => setEditOpen(false)}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
        >
          <FiX size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-minimal">
        
        {/* Active Charts */}
        <div className="space-y-2">
          <button 
            onClick={() => setIsActiveOpen(!isActiveOpen)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-xl">
                 <FiBarChart2 size={24} />
              </div>
              <div>
                 <span className="block font-semibold text-slate-800 text-base">Active Charts</span>
                 <span className="text-sm text-slate-500">{activeCharts.length} visible</span>
              </div>
            </div>
            {isActiveOpen ? <FiChevronDown /> : <FiChevronRight />}
          </button>
          
          {isActiveOpen && (
            <div className="space-y-3 pt-1 pl-1 pr-1 animate-in slide-in-from-top-2 duration-200">
              {activeCharts.map(chart => (
                <div key={chart.id} className="p-3 border border-slate-100 rounded-lg shadow-sm bg-white">
                  <div className="flex items-start justify-between mb-3">
                  <div className="flex min-w-0 items-center gap-2">
                      <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                        {getIcon(chart.kind)}
                      </div>
                      <span className="min-w-0 flex-1 text-sm font-medium text-slate-700 truncate">{chart.title}</span>
                    </div>
                    <button 
                      onClick={() => removeChart(chart.id)}
                      className="text-slate-400 hover:text-red-500 flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <FiMinusCircle /> Remove
                    </button>
                  </div>

                  {chart.kind !== 'insight' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {AVAILABLE_CHART_TYPES.map(k => (
                        <button
                          key={k}
                          onClick={() => updateChartKind(chart.id, k as ChartKind)}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded text-xs gap-1 border transition-all ${
                            chart.kind === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          {getIcon(k as ChartKind)}
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

        {/* Inactive Charts */}
        <div className="space-y-2">
          <button 
            onClick={() => setIsInactiveOpen(!isInactiveOpen)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl">
                 <FiList size={24} />
              </div>
              <div>
                 <span className="block font-semibold text-slate-800 text-base">Inactive Charts</span>
                 <span className="text-sm text-slate-500">{inactiveCharts.length} hidden</span>
              </div>
            </div>
            {isInactiveOpen ? <FiChevronDown /> : <FiChevronRight />}
          </button>
          
          {isInactiveOpen && (
            <div className="space-y-2 pt-1 pl-1 pr-1 animate-in slide-in-from-top-2 duration-200">
              {inactiveCharts.map(chart => (
                <div key={chart.id} className="flex items-center justify-between gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm">
                  <span className="min-w-0 flex-1 text-sm text-slate-600 truncate">{chart.title}</span>
                  <button 
                    onClick={() => addChart(chart.id)}
                    className="p-1.5 bg-white border border-slate-200 text-green-600 rounded hover:bg-green-50"
                  >
                    <FiPlus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>


      </div>

      <div className="p-5 border-t border-slate-100 bg-white shrink-0 flex gap-3">
        <button onClick={deleteAllCharts} className="w-full py-2.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg font-medium transition-colors">
          Delete All
        </button>
        <button onClick={() => setEditOpen(false)} className="w-full py-2.5 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded-lg font-medium">
          Done
        </button>
      </div>
    </div>
  );
}

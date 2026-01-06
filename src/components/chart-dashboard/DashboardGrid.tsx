'use client';

import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { FiGrid, FiColumns, FiList, FiSidebar, FiRotateCcw, FiEdit2 } from 'react-icons/fi';
import { DashboardProvider, useDashboard } from '@/context/DashboardContext';
import { ReportChartSchema } from '@/lib/charts/ChartTypes';
import { GRID_CONFIG, UI_TEXT } from '@/lib/constants/dashboard';

import ChartCard from './ChartCard';
import InsightCard from './InsightCard';
import EditPanel from './EditPanel';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/dashboard.css';

// Responsive Grid Layout
const ResponsiveGridLayout = WidthProvider(Responsive);

// Dashboard Component
interface DashboardProps {
  initialSchemas?: ReportChartSchema[];
  initialDataset?: any[];
  initialCanvasState?: any; 
  initialLayoutMode?: string;   
  reportRecordId?: string;
}

// Main Dashboard Grid Component
export default function DashboardGrid(props: DashboardProps) {
  return (
    <DashboardProvider {...props}>
      <DashboardInner />
    </DashboardProvider>
  );
}

// Inner Dashboard Component
function DashboardInner() {
  const { 
    activeCharts, 
    currentLayouts,
    layoutMode,
    isMounted,
    setEditOpen,
    applyLayoutPreset,
    updateLayout,
    resetDashboard
  } = useDashboard();

  if (!isMounted) return null;

  // Render
  return (
    <div className="flex flex-col items-center w-full max-w-[1400px] mx-auto p-6">
      <EditPanel />

      {/* Toolbar */}
      <div className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl shadow-sm p-3 mb-6 sticky top-4 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (window.confirm(UI_TEXT.CONFIRM_RESET)) resetDashboard();
            }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm active:scale-95 flex items-center gap-2">
            <FiRotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
          {[
            { id: 'grid', icon: FiGrid },
            { id: 'two-columns', icon: FiColumns },
            { id: 'single-row', icon: FiList },
            { id: 'insight', icon: FiSidebar }
          ].map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => applyLayoutPreset(id as any)}
              className={`p-2 rounded-md transition-all ${
                layoutMode === id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}

          <button 
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors shadow-sm active:scale-95 flex items-center gap-2"
          >
            <FiEdit2 size={14} /> Configure
          </button>
        </div>
      </div>

      {/* Grid Canvas */}
      <div 
        className="dashboard-area w-full min-h-screen"
        style={{
          backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(to right, #f1f5f9 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {activeCharts.length === 0 && (
          <div className="flex h-96 items-center justify-center text-slate-400 italic">
            {UI_TEXT.NO_CHARTS}
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={currentLayouts}
          breakpoints={GRID_CONFIG.breakpoints}
          cols={GRID_CONFIG.cols}
          rowHeight={GRID_CONFIG.rowHeight}
          margin={GRID_CONFIG.margin}
          onLayoutChange={updateLayout}
          draggableHandle=".dragHandle"
        >
          {activeCharts.map(cfg => (
            <div key={cfg.id} className="relative group">
              {cfg.kind === 'insight' ? (
                <InsightCard config={cfg} />
              ) : (
                <ChartCard config={cfg} />
              )}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
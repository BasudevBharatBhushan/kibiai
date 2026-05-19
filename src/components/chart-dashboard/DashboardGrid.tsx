'use client';

import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { FiGrid, FiColumns, FiList, FiSidebar, FiRotateCcw } from 'react-icons/fi';
import { useDashboard } from '@/context/DashboardContext';
import { GRID_CONFIG, UI_TEXT } from '@/constants/dashboard';
import type { LayoutMode } from '@/constants/dashboard';

import ChartCard from './ChartCard';
import InsightCard from './InsightCard';
import EditPanel from './EditPanel';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/dashboard.css';

// Responsive Grid Layout
const ResponsiveGridLayout = WidthProvider(Responsive);

// Main Dashboard Grid Component
export default function DashboardGrid() {
  return <DashboardInner />;
}

// Inner Dashboard Component
function DashboardInner() {
  const { 
    activeCharts, 
    currentLayouts,
    layoutMode,
    isMounted,
    applyLayoutPreset,
    updateLayout,
    resetDashboard,
    isViewerMode,
    isEditOpen,
  } = useDashboard();

  if (!isMounted) return null;

  // Render
  return (
    <div className="flex w-full h-full overflow-hidden relative">
      <div className="flex-1 overflow-auto bg-slate-50 scrollbar-minimal flex flex-col px-4 py-6 lg:px-6 pb-96 relative transition-all duration-300">
        {/* Toolbar */}
        {!isViewerMode && (
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
                onClick={() => applyLayoutPreset(id as LayoutMode)}
                className={`p-2 rounded-md transition-all ${
                  layoutMode === id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={18} />
              </button>
            ))}

          </div>
        </div>
        )}

        {/* Grid Canvas */}
        <div 
          className="dashboard-area min-h-full"
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
            draggableHandle={isViewerMode ? undefined : ".dragHandle"}
            isDraggable={!isViewerMode}
            isResizable={!isViewerMode}
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
          
          {/* Spacer to guarantee scrolling past the bottom-most chart */}
          <div className="w-full h-48 pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Edit Panel (Right) */}
      {!isViewerMode && (
        <div
          className={`bg-white border-l-2 border-slate-300 h-full shadow-[-6px_0_18px_-6px_rgba(15,23,42,0.18)] z-20 transition-[width] duration-300 ease-in-out flex flex-col shrink-0 ${
            isEditOpen
              ? "w-[400px]"
              : "w-0 border-none overflow-hidden"
          }`}
        >
          <div className="flex-1 overflow-hidden relative flex flex-col min-w-[400px]">
            <EditPanel />
          </div>
        </div>
      )}
    </div>
  );
}

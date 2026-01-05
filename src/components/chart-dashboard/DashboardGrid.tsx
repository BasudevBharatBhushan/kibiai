'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FiGrid, FiColumns, FiList, FiSidebar, FiRotateCcw, FiEdit2 } from 'react-icons/fi';
import ChartCard from './ChartCard';
import InsightCard from './InsightCard';
import EditPanel from './EditPanel';
import { processData } from '@/lib/charts/DataProcessor';
import { ChartConfig, ChartKind, ReportChartSchema, COLOR_PALETTES } from '@/lib/charts/ChartTypes';

import { updateChartStatus } from '@/lib/client/chartActions';
import { saveDashboardState } from '@/lib/client/dashboardAction';

import { 
  ALLOWED_LAYOUTS, 
  GRID_CONFIG, 
  DASHBOARD_DEFAULTS, 
  type LayoutMode, 
  UI_TEXT
} from '@/lib/constants/dashboard';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/dashboard.css';
import { PROCESSOR_DEFAULTS } from '@/lib/constants/analytics';

//RGL Component for Responsive Grid
const ResponsiveGridLayout = WidthProvider(Responsive);

//Props from Server Component
interface DashboardProps {
  initialSchemas?: ReportChartSchema[];
  initialDataset?: any[];
  initialCanvasState?: any; 
  initialLayoutMode?: string;   
  reportRecordId?: string;
}


// Normalize layout mode value
function normalizeLayoutMode(value?: string): LayoutMode {
  return ALLOWED_LAYOUTS.includes(value as LayoutMode)
    ? (value as LayoutMode)
    : DASHBOARD_DEFAULTS.layoutMode;
}

export default function Dashboard({ 
  initialSchemas = [], 
  initialDataset = [], 
  initialCanvasState, 
  initialLayoutMode = 'grid',
  reportRecordId 
}: DashboardProps) {
  
  // --- STATE MANAGEMENT ---
  const [allCharts, setAllCharts] = useState<ChartConfig[]>([]);
  const [visibleChartIds, setVisibleChartIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Layout Mode
  const [activeLayout, setActiveLayout] = useState<LayoutMode>(
    normalizeLayoutMode(initialLayoutMode)
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // --- DERIVED STATE ---
  const visibleCharts = useMemo(() => {
    return allCharts.filter(c => visibleChartIds.has(c.id));
  }, [allCharts, visibleChartIds]);

  const inactiveCharts = useMemo(() => {
    return allCharts.filter(c => !visibleChartIds.has(c.id));
  }, [allCharts, visibleChartIds]);

  // The layout object required by React-Grid-Layout
  const currentLayouts = useMemo(() => {
    return { lg: visibleCharts.map(c => c.layout!) };
  }, [visibleCharts]);


  // --- INITIALIZATION (DB) ---
  // This effect runs once on mount to merge "Live Data" with "Saved User Layouts"
  useEffect(() => {
    setMounted(true);
    if (hasInitialized.current) return;

    if (initialSchemas.length > 0) {
      
      //Process raw data into chart configs
      const processed = processData(initialDataset, initialSchemas);
      
      // Merge with saved canvas state if available
      let finalCharts = processed.map((c, i) => ({
        ...c,
        colors: COLOR_PALETTES[i % COLOR_PALETTES.length],
        layout: { x: (i % 2) * 6, y: Math.floor(i / 2) * 9, w: 6, h: 9, i: c.id }
      }));
      
      //Determine visibility based on the raw 'isActive' flag from schema
      let initialVisibleIds = new Set(processed.filter(c => c.isActive).map(c => c.id));

      //If we have saved state, override layouts and visibility
      if (initialCanvasState && Array.isArray(initialCanvasState) && initialCanvasState.length > 0) {
        finalCharts = finalCharts.map(chart => {
          const saved = initialCanvasState.find((s: any) => s.id === chart.id);
          if (saved) {
             return { ...chart, layout: saved.layout, kind: saved.kind };
          }
          return chart;
        });

        initialVisibleIds = new Set(initialCanvasState.map((s: any) => s.id));
      } else {
        console.log("[Dashboard] No saved state found. Using default layout.");
      }

      setAllCharts(finalCharts);
      setVisibleChartIds(initialVisibleIds);
      if (initialLayoutMode) {
        setActiveLayout(normalizeLayoutMode(initialLayoutMode));
      }
      hasInitialized.current = true;
    } 
  }, [initialSchemas, initialDataset, initialCanvasState, initialLayoutMode]);


  // --- AUTO-SAVE LOGIC ---
  //Debounced save function to prevent API spam while dragging/resizing
  const triggerAutoSave = useCallback((currentCharts: ChartConfig[], visibleIds: Set<string>, currentLayoutMode: string) => {
    if (!reportRecordId) {
        console.warn("[Dashboard] Cannot save: Missing reportRecordId");
        return;
    }

    // Clear previous pending save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const chartsToSave = currentCharts
        .filter(c => visibleIds.has(c.id))
        .map(c => ({
          id: c.id,
          layout: c.layout,
          kind: c.kind
        }));

      const payload = {
        layoutMode: currentLayoutMode,
        charts: chartsToSave
      }

      saveDashboardState(reportRecordId, payload);
    }, 100);
  }, [reportRecordId]);


  // --- EVENT HANDLERS ---

  // Layout Change 
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setAllCharts(prevCharts => {
      let hasChanges = false;

      const layoutMap = new Map(newLayout.map(l => [l.i, l]));

      const nextCharts = prevCharts.map(c => {
        const l = layoutMap.get(c.id);
        if (!l) return c; // Hidden chart

        if (
          l.x !== c.layout?.x || 
          l.y !== c.layout?.y || 
          l.w !== c.layout?.w || 
          l.h !== c.layout?.h
        ) {
          hasChanges = true;
          return { ...c, layout: { ...l, i: c.id } };
        }
        return c;
      });

      if (hasChanges) {
        triggerAutoSave(nextCharts, visibleChartIds, activeLayout); 
        return nextCharts;
      }
      return prevCharts;
    });
  }, [triggerAutoSave, visibleChartIds, activeLayout]);

  // Add/Remove Chart 
  function handleRemove(id: string) {
    const nextIds = new Set(visibleChartIds);
    nextIds.delete(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);

    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
      updateChartStatus(chart.fmRecordId, { isActive: false });
    }
  }

  // Add/Remove Chart
  function handleAdd(id: string) {
    const nextIds = new Set(visibleChartIds);
    nextIds.add(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);

    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
      updateChartStatus(chart.fmRecordId, { isActive: true });
    }
  }

  // Change Chart Kind
  function handleChangeKind(id: string, kind: ChartKind) {
    setAllCharts(prev => {
      const next = prev.map(c => c.id === id ? { ...c, kind } : c);
      triggerAutoSave(next, visibleChartIds, activeLayout); 
      return next;
    });
  
    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
       updateChartStatus(chart.fmRecordId, { type: kind });
    }
  }

  // Apply Layout Mode
  function applyLayout(type: typeof activeLayout) {
    setActiveLayout(type);
    setAllCharts(prev => {
      let sorted = [...prev];
      if (type === 'insight') {
        sorted.sort((a, b) => (b.kind === 'insight' ? 1 : 0) - (a.kind === 'insight' ? 1 : 0));
      }
      
      const newCharts = sorted.map((c, i) => {
        const l = { ...c.layout! };
        if (type === 'grid') { l.w = PROCESSOR_DEFAULTS.LAYOUT_WIDTH; l.h = PROCESSOR_DEFAULTS.LAYOUT_HEIGHT; l.x = (i % 2) * 6; l.y = Math.floor(i / 2) * 9; }
        if (type === 'two-columns') { l.w = 6; l.h = 14; l.x = (i % 2) * 6; l.y = Math.floor(i / 2) * 14; }
        if (type === 'single-row') { l.w = 12; l.h = 10; l.x = 0; l.y = i * 10; }
        if (type === 'insight') {
          if (c.kind === 'insight') { 
            l.w = 6; 
            l.h = 14; 
            l.x = (i % 2) * 6; 
            l.y = Math.floor(i / 2) * 14; 
          } 
          else { 
            const offset = sorted.filter(x => x.kind === 'insight').length;
            const ci = i - offset;
            l.w = 6; l.h = 9; l.x = (ci % 2) * 6; l.y = (offset * 8) + Math.floor(ci / 2) * 9; 
          }
        }
        return { ...c, layout: l };
      });
      
      triggerAutoSave(newCharts, visibleChartIds, activeLayout); 
      return newCharts;
    });
  }

  // Reset Dashboard
  async function handleReset() {
    if (window.confirm(UI_TEXT.CONFIRM_RESET)) {
      if (reportRecordId) {
        const resetState = {
          layoutMode: 'grid',
          charts: []
        };
        
        await saveDashboardState(reportRecordId, resetState);
        window.location.reload();
      } else {
        window.location.reload();
      }
    }
  }

  if (!mounted) return null;

  // --- RENDER ---
  return (
    <div className="flex flex-col items-center w-full max-w-400 mx-auto p-6">
      <EditPanel 
        isOpen={isEditOpen} 
        onClose={() => setIsEditOpen(false)} 
        activeCharts={visibleCharts}
        inactiveCharts={inactiveCharts}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onChangeKind={handleChangeKind} 
      />

      {/* --- TOOLBAR --- */}
      <div className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl shadow-sm p-3 mb-6 sticky top-4 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReset}
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
              onClick={() => applyLayout(id as any)}
              className={`layout-btn ${activeLayout === id ? 'layout-btn-active' : 'layout-btn-inactive'}`}>
              <Icon size={18} />
            </button>
          ))}

          <button 
            onClick={() => setIsEditOpen(true)}
            className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors shadow-sm active:scale-95 flex items-center gap-2">
            <FiEdit2 size={14} /> Configure
          </button>
        </div>
      </div>
      {/* --- CANVAS --- */}
      <div 
        className="dashboard-area w-full"
        style={{
          backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(to right, #f1f5f9 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {visibleCharts.length === 0 && (
          <div className="flex h-100 items-center justify-center text-slate-400 italic">
            No charts visible. Click "Configure" to add charts.
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={currentLayouts}
          breakpoints={GRID_CONFIG.breakpoints}
          cols={GRID_CONFIG.cols}
          rowHeight={GRID_CONFIG.rowHeight}
          margin={GRID_CONFIG.margin}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".dragHandle">
          {visibleCharts.map(cfg => (
            <div key={cfg.id} className="relative group">
              {cfg.kind === 'insight' ? (
                <InsightCard config={cfg} onRemove={handleRemove} />
              ) : (
                <ChartCard 
                  config={cfg} 
                  onRemove={handleRemove} 
                  onChangeKind={handleChangeKind}
                />
              )}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
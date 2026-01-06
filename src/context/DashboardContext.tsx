'use client';

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  ReactNode
} from 'react';
import { Layout } from 'react-grid-layout';

// Types & Configs
import { 
  ChartConfig, 
  ChartKind, 
  ReportChartSchema, 
  COLOR_PALETTES 
} from '@/lib/charts/ChartTypes';
import { 
  ALLOWED_LAYOUTS, 
  DASHBOARD_DEFAULTS, 
  type LayoutMode 
} from '@/lib/constants/dashboard';
import { PROCESSOR_DEFAULTS } from '@/lib/constants/analytics';

// Logic & API
import { processData } from '@/lib/charts/DataProcessor';
import { updateChartStatus } from '@/lib/client/chartActions';
import { saveDashboardState } from '@/lib/client/dashboardAction';

// --- Types ---

interface DashboardContextType {
  // State
  activeCharts: ChartConfig[];
  inactiveCharts: ChartConfig[];
  layoutMode: LayoutMode;
  isEditOpen: boolean;
  isMounted: boolean;
  currentLayouts: { lg: Layout[] }; // For React-Grid-Layout
  reportRecordId?: string;

  // Actions
  setEditOpen: (isOpen: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  
  // Chart Operations
  addChart: (id: string) => void;
  removeChart: (id: string) => void;
  updateChartKind: (id: string, kind: ChartKind) => void;
  
  // Layout Operations
  updateLayout: (newLayout: Layout[]) => void; 
  applyLayoutPreset: (mode: LayoutMode) => void; 
  resetDashboard: () => Promise<void>;
}

interface DashboardProviderProps {
  children: ReactNode;
  initialSchemas?: ReportChartSchema[];
  initialDataset?: any[];
  initialCanvasState?: any; 
  initialLayoutMode?: string;   
  reportRecordId?: string;
}

// --- Helpers ---

function normalizeLayoutMode(value?: string): LayoutMode {
  return ALLOWED_LAYOUTS.includes(value as LayoutMode)
    ? (value as LayoutMode)
    : DASHBOARD_DEFAULTS.layoutMode;
}

// --- Context ---

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ 
  children, 
  initialSchemas = [], 
  initialDataset = [], 
  initialCanvasState, 
  initialLayoutMode = 'grid',
  reportRecordId 
}: DashboardProviderProps) {
  
  // --- STATE ---
  const [allCharts, setAllCharts] = useState<ChartConfig[]>([]);
  const [visibleChartIds, setVisibleChartIds] = useState<Set<string>>(new Set());
  const [activeLayout, setActiveLayout] = useState<LayoutMode>(normalizeLayoutMode(initialLayoutMode));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);

  // --- DERIVED DATA ---
  
  const activeCharts = useMemo(() => {
    return allCharts.filter(c => visibleChartIds.has(c.id));
  }, [allCharts, visibleChartIds]);

  const inactiveCharts = useMemo(() => {
    return allCharts.filter(c => !visibleChartIds.has(c.id));
  }, [allCharts, visibleChartIds]);

  const currentLayouts = useMemo(() => {
    return { lg: activeCharts.map(c => c.layout!) };
  }, [activeCharts]);

  // --- INITIALIZATION ---
  

useEffect(() => {
  setIsMounted(true);

  if (hasInitialized.current) return;

  if (initialSchemas && initialSchemas.length > 0) {
    
    // 1. Process Data
    const processed = processData(initialDataset || [], initialSchemas);

    // 2. Assign Defaults
    let finalCharts = processed.map((c, i) => ({
      ...c,
      colors: COLOR_PALETTES[i % COLOR_PALETTES.length],
      layout: { 
        // Fallback to hardcoded numbers if constant is missing
        x: (i % 2) * (PROCESSOR_DEFAULTS?.LAYOUT_WIDTH || 6), 
        y: Math.floor(i / 2) * (PROCESSOR_DEFAULTS?.LAYOUT_HEIGHT || 9), 
        w: PROCESSOR_DEFAULTS?.LAYOUT_WIDTH || 6, 
        h: PROCESSOR_DEFAULTS?.LAYOUT_HEIGHT || 9, 
        i: c.id 
      }
    }));

    // 3. Visibility
    let initialVisibleIds = new Set(processed.filter(c => c.isActive).map(c => c.id));

    // 4. Merge Saved State
    if (initialCanvasState && Array.isArray(initialCanvasState) && initialCanvasState.length > 0) {
      finalCharts = finalCharts.map(chart => {
        const saved = initialCanvasState.find((s: any) => s.id === chart.id);
        if (saved) {
           return { ...chart, layout: saved.layout, kind: saved.kind };
        }
        return chart;
      });
      initialVisibleIds = new Set(initialCanvasState.map((s: any) => s.id));
    }

    setAllCharts(finalCharts);
    setVisibleChartIds(initialVisibleIds);
    if (initialLayoutMode) {
      setActiveLayout(normalizeLayoutMode(initialLayoutMode));
    }
    
    hasInitialized.current = true;
  } else {
    console.warn("[Ctx] Skipping init: No schemas provided");
  }
}, [initialSchemas, initialDataset, initialCanvasState, initialLayoutMode]);

  // --- AUTO-SAVE ---

  const triggerAutoSave = useCallback((currentCharts: ChartConfig[], visibleIds: Set<string>, currentLayoutMode: string) => {
    if (!reportRecordId) {
        console.warn("[DashboardContext] Cannot save: Missing reportRecordId");
        return;
    }

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
    }, 500);
  }, [reportRecordId]);


  // --- ACTIONS ---

  // 1. React-Grid-Layout Change Handler (Drag/Resize)
  const updateLayout = useCallback((newLayout: Layout[]) => {
    setAllCharts(prevCharts => {
      let hasChanges = false;
      const layoutMap = new Map(newLayout.map(l => [l.i, l]));

      const nextCharts = prevCharts.map(c => {
        const l = layoutMap.get(c.id);
        if (!l) return c; 

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

  // 2. Chart Visibility Actions
  const addChart = (id: string) => {
    const nextIds = new Set(visibleChartIds);
    nextIds.add(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);

    // Sync to FileMaker 
    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
      updateChartStatus(chart.fmRecordId, { isActive: true });
    }
  };

  const removeChart = (id: string) => {
    const nextIds = new Set(visibleChartIds);
    nextIds.delete(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);

    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
      updateChartStatus(chart.fmRecordId, { isActive: false });
    }
  };

  // 3. Chart Type Change
  const updateChartKind = (id: string, kind: ChartKind) => {
    setAllCharts(prev => {
      const next = prev.map(c => c.id === id ? { ...c, kind } : c);
      triggerAutoSave(next, visibleChartIds, activeLayout); 
      return next;
    });
  
    const chart = allCharts.find(c => c.id === id);
    if (chart && chart.fmRecordId) {
       updateChartStatus(chart.fmRecordId, { type: kind });
    }
  };

  // 4. Layout Presets (Grid, Columns, etc.)
  const applyLayoutPreset = (type: LayoutMode) => {
    setActiveLayout(type);
    
    setAllCharts(prev => {
      let sorted = [...prev];
      
      // Insight Layout
      if (type === 'insight') {
        sorted.sort((a, b) => (b.kind === 'insight' ? 1 : 0) - (a.kind === 'insight' ? 1 : 0));
      }
      
      const newCharts = sorted.map((c, i) => {
        const l = { ...c.layout! };
        
        // --- Layout Algorithms ---
        if (type === 'grid') { 
            l.w = 6; l.h = 9; 
            l.x = (i % 2) * 6; l.y = Math.floor(i / 2) * 9; 
        }
        if (type === 'two-columns') { 
            l.w = 6; l.h = 14; 
            l.x = (i % 2) * 6; l.y = Math.floor(i / 2) * 14; 
        }
        if (type === 'single-row') { 
            l.w = 12; l.h = 10; 
            l.x = 0; l.y = i * 10; 
        }
        if (type === 'insight') {
          if (c.kind === 'insight') { 
            l.w = 6; l.h = 14; 
            l.x = (i % 2) * 6; l.y = Math.floor(i / 2) * 14; 
          } 
          else { 
            const offset = sorted.filter(x => x.kind === 'insight').length;
            const ci = i - offset;
            l.w = 6; l.h = 9; 
            l.x = (ci % 2) * 6; l.y = (offset * 8) + Math.floor(ci / 2) * 9; 
          }
        }
        return { ...c, layout: l };
      });
      
      triggerAutoSave(newCharts, visibleChartIds, type); 
      return newCharts;
    });
  };

  // 5. Reset
  const resetDashboard = async () => {
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
  };

  // --- VALUE ---
  
  const value = {
    // State
    activeCharts,
    inactiveCharts,
    layoutMode: activeLayout,
    isEditOpen,
    isMounted,
    currentLayouts,
    reportRecordId,

    // Actions
    setEditOpen: setIsEditOpen,
    setLayoutMode: setActiveLayout,
    addChart,
    removeChart,
    updateChartKind,
    updateLayout,
    applyLayoutPreset,
    resetDashboard
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// --- HOOK ---

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
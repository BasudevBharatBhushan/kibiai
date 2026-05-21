'use client';

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  useRef,
  ReactNode,
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
} from '@/constants/dashboard';
import { PROCESSOR_DEFAULTS } from '@/constants/analytics';
import { useDebouncedCallback } from '@/lib/hooks/useDebounce';

// Logic & API
import { processData } from '@/lib/charts/DataProcessor';
import { apiClient } from '@/utils/apiClient';

// --- Types ---

interface DashboardContextType {
  // State
  activeCharts: ChartConfig[];
  inactiveCharts: ChartConfig[];
  layoutMode: LayoutMode;
  isEditOpen: boolean;
  isMounted: boolean;
  currentLayouts: { lg: Layout[] };
  templateId?: string;
  isViewerMode: boolean;
  dataset: any[]; // Exposed report rows for AI chart processing
  context?: import('@/lib/charts/ChartTypes').InsightContext;

  // Actions
  setEditOpen: (isOpen: boolean) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  
  // Chart Operations
  addChart: (id: string) => void;
  removeChart: (id: string) => void;
  updateChartKind: (id: string, kind: ChartKind) => void;
  
  // AI Chart Injection
  addNewChartFromAI: (schema: ReportChartSchema) => void;
  addMultipleChartsFromAI: (schemas: ReportChartSchema[]) => void;

  // Layout Operations
  updateLayout: (newLayout: Layout[]) => void; 
  applyLayoutPreset: (mode: LayoutMode) => void; 
  resetDashboard: () => Promise<void>;
  deleteAllCharts: () => Promise<void>;
}

interface DashboardProviderProps {
  children: ReactNode;
  initialSchemas?: ReportChartSchema[];
  initialDataset?: any[];
  initialCanvasState?: any;
  initialLayoutMode?: string;
  templateId?: string;
  isViewerMode?: boolean;
  context?: import('@/lib/charts/ChartTypes').InsightContext;
  /** Field schemas used by the insight formula executor for safe identifier mapping */
  fieldSchemas?: import('@/lib/insights/fieldSchemaAdapter').FieldSchema[];
  onNewChart?: (schema: ReportChartSchema) => void;
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
  templateId,
  isViewerMode = false,
  context,
  fieldSchemas,
  onNewChart,
}: DashboardProviderProps) {
  
  // --- STATE ---
  const [allCharts, setAllCharts] = useState<ChartConfig[]>([]);
  const [visibleChartIds, setVisibleChartIds] = useState<Set<string>>(new Set());
  const [activeLayout, setActiveLayout] = useState<LayoutMode>(normalizeLayoutMode(initialLayoutMode));
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [dataset, setDataset] = useState<any[]>(initialDataset);

  // Refs — prevent processData running more than once per data-source change
  const hasInitialized = useRef(false);
  const prevSchemasRef = useRef<ReportChartSchema[]>(initialSchemas);
  const prevDatasetRef = useRef<any[]>(initialDataset);

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

    if (!initialSchemas || initialSchemas.length === 0) {
      console.warn("[Ctx] Skipping init: No schemas provided");
      return;
    }

    // Guard: only re-run processData when the actual data source changes (schemas or dataset),
    // not on every re-render caused by internal state changes (context, layoutMode, canvasState).
    const schemasChanged = initialSchemas !== prevSchemasRef.current;
    const datasetChanged = initialDataset !== prevDatasetRef.current;
    if (hasInitialized.current && !schemasChanged && !datasetChanged) {
      return;
    }
    prevSchemasRef.current = initialSchemas;
    prevDatasetRef.current = initialDataset;
    hasInitialized.current = true;

    console.log("[Ctx] Init START", { 
      schemaCount: initialSchemas?.length, 
      datasetCount: initialDataset?.length, 
      context 
    });

    // 1. Process Data — context passed here so viewer-mode filter bypass applies
    const processed = processData(initialDataset || [], initialSchemas, context, fieldSchemas);
    console.group('[Ctx] Init — processData output');
    console.log('[Ctx] Processed Charts:', processed.map(c => ({ id: c.id, title: c.title, isActive: c.isActive, kind: c.kind })));
    console.log('[Ctx] initialCanvasState from DB:', initialCanvasState?.map((s: any) => ({ id: s.id, isActive: s.isActive })));
    console.groupEnd();

    // 2. Assign Defaults
    const defaultW = PROCESSOR_DEFAULTS?.LAYOUT_WIDTH || 6;
    const defaultH = PROCESSOR_DEFAULTS?.LAYOUT_HEIGHT || 9;

    let finalCharts = processed.map((c, i) => ({
      ...c,
      colors: COLOR_PALETTES[i % COLOR_PALETTES.length],
      layout: { 
        x: (i % 2) * defaultW, 
        y: Math.floor(i / 2) * defaultH, 
        w: defaultW, 
        h: defaultH, 
        i: c.id 
      }
    }));

    // 3. Visibility
    let initialVisibleIds = new Set(processed.filter(c => c.isActive).map(c => c.id));

    // 4. Merge Saved State
    if (initialCanvasState && Array.isArray(initialCanvasState) && initialCanvasState.length > 0) {
      const isValidLayout = (l: any) =>
        l &&
        Number.isFinite(l.x) &&
        Number.isFinite(l.y) &&
        Number.isFinite(l.w) &&
        Number.isFinite(l.h);

      // Build a lookup map from chart_template_id → saved canvas state entry
      // (handles both direct charts and insight parent IDs)
      const savedById = new Map<string, any>(
        initialCanvasState.map((s: any) => [s.id, s])
      );

      /**
       * Resolve the "canonical" parent UUID for any chart.
       * Insight sub-cards use `${parentUUID}-N` pattern.
       * UUID is exactly 36 chars so the regex is unambiguous.
       */
      const SUB_CARD_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d+)$/i;
      const resolveParentId = (chartId: string): string => {
        const match = chartId.match(SUB_CARD_RE);
        return match ? match[1] : chartId;
      };

      finalCharts = finalCharts.map(chart => {
        // Try direct match first, then parent-ID fallback for sub-cards
        const saved = savedById.get(chart.id) ?? savedById.get(resolveParentId(chart.id));
        if (!saved) return chart;

        // For sub-cards, look for this specific sub-card's layout inside subCardLayouts
        let savedLayout = saved.layout;
        if (saved.subCardLayouts && Array.isArray(saved.subCardLayouts)) {
          const subCardEntry = saved.subCardLayouts.find((s: any) => s.id === chart.id);
          if (subCardEntry?.layout) savedLayout = subCardEntry.layout;
        }

        const mergedLayout = isValidLayout(savedLayout)
          ? {
              ...chart.layout,
              ...savedLayout,
              i: chart.id,     // Always use the sub-card's own ID as the grid key
              w: savedLayout?.w ?? chart.layout?.w ?? defaultW,
              h: savedLayout?.h ?? chart.layout?.h ?? defaultH,
            }
          : chart.layout;

        return { ...chart, layout: mergedLayout, kind: saved.kind ?? chart.kind };
      });

      // --- Visibility Resolution ---
      // For regular charts: use saved.isActive directly.
      // For insight sub-cards: use parent saved entry's isActive.
      // A sub-card is visible if its parent's isActive !== false.
      initialVisibleIds = new Set<string>();

      console.group('[Ctx] Init — visibility resolution');
      console.log('[Ctx] savedById keys:', [...savedById.keys()]);
      for (const c of finalCharts) {
        const saved = savedById.get(c.id) ?? savedById.get(resolveParentId(c.id));
        if (saved) {
          // Has a DB record — respect whatever isActive says
          const active = saved.isActive !== false;
          console.log(`[Ctx] Saved entry for "${c.id}" → parentId="${resolveParentId(c.id)}" isActive=${active}`);
          if (active) initialVisibleIds.add(c.id);
        } else {
          // Brand-new chart with no saved state — activate by default (isActive from processData)
          console.log(`[Ctx] No saved entry for "${c.id}" (new) → defaulting to isActive=${c.isActive}`);
          if (c.isActive) initialVisibleIds.add(c.id);
        }
      }
      console.log('[Ctx] FINAL visibleIds:', [...initialVisibleIds]);
      console.groupEnd();
    }

    setAllCharts(finalCharts);
    setVisibleChartIds(initialVisibleIds);
    if (initialLayoutMode) {
      setActiveLayout(normalizeLayoutMode(initialLayoutMode));
    }
    
    console.log("[Ctx] Init COMPLETE", { finalCount: finalCharts.length, visibleCount: initialVisibleIds.size });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSchemas, initialDataset, initialCanvasState, initialLayoutMode, context]);

  // Keep dataset in sync when initialDataset changes (e.g. after client fetch)
  useEffect(() => {
    if (initialDataset && initialDataset.length > 0) {
      setDataset(initialDataset);
    }
  }, [initialDataset]);

  // --- AUTO-SAVE ---
  const triggerAutoSave = useDebouncedCallback(
    (currentCharts: ChartConfig[], visibleIds: Set<string>, currentLayoutMode: string) => {
      if (!templateId || isViewerMode) {
        return;
      }

      // Insight sub-cards are named `${parentUUID}-N` (e.g. "abc-def-0").
      // The DB only has one row per parent UUID, so we must normalize sub-card IDs
      // back to the parent UUID before sending to the API.
      const SUB_CARD_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-(\d+)$/i;

      // Map: parentId → { isActive, subCardLayouts, kind }
      const parentMap = new Map<string, {
        isActive: boolean;
        layout?: ChartConfig['layout'];
        subCardLayouts: Array<{ id: string; layout: ChartConfig['layout'] }>;
        kind?: string;
      }>();

      for (const c of currentCharts) {
        const match = c.id.match(SUB_CARD_RE);
        if (match) {
          // Insight sub-card — roll up into parent entry
          const parentId = match[1];
          const isVisible = visibleIds.has(c.id);
          if (!parentMap.has(parentId)) {
            parentMap.set(parentId, { isActive: false, subCardLayouts: [], kind: c.kind });
          }
          const entry = parentMap.get(parentId)!;
          // Parent is active if ANY sub-card is visible
          if (isVisible) entry.isActive = true;
          entry.subCardLayouts.push({ id: c.id, layout: c.layout });
        } else {
          // Regular chart — save directly
          parentMap.set(c.id, {
            isActive: visibleIds.has(c.id),
            layout: c.layout,
            subCardLayouts: [],
            kind: c.kind,
          });
        }
      }

      const chartsToSave = [...parentMap.entries()].map(([id, entry]) => ({
        id,
        isActive: entry.isActive,
        layout: entry.layout,
        kind: entry.kind,
        subCardLayouts: entry.subCardLayouts.length > 0 ? entry.subCardLayouts : undefined,
      }));

      const payload = {
        layoutMode: currentLayoutMode,
        charts: chartsToSave,
      };

      apiClient
        .patch(`/api/report-templates/${templateId}/charts/canvas-batch`, payload)
        .catch((error) => {
          console.error("[DashboardContext] Failed to save canvas state:", error);
        });
    }, 
    500
  );

  // --- ACTIONS ---

  // 1. React-Grid-Layout Change Handler (Drag/Resize)
  const updateLayout = useCallback((newLayout: Layout[]) => {
    if (isViewerMode) return;

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
  }, [triggerAutoSave, visibleChartIds, activeLayout, isViewerMode]);

  // 2. Chart Visibility Actions
  const addChart = (id: string) => {
    if (isViewerMode) return;
    const nextIds = new Set(visibleChartIds);
    nextIds.add(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);
  };

  const removeChart = (id: string) => {
    if (isViewerMode) return;
    const nextIds = new Set(visibleChartIds);
    nextIds.delete(id);
    setVisibleChartIds(nextIds);
    
    triggerAutoSave(allCharts, nextIds, activeLayout);
  };

  // 3. Chart Type Change
  const updateChartKind = (id: string, kind: ChartKind) => {
    if (isViewerMode) return;
    setAllCharts(prev => {
      const next = prev.map(c => c.id === id ? { ...c, kind } : c);
      triggerAutoSave(next, visibleChartIds, activeLayout); 
      return next;
    });
  };

  // 4. Layout Presets (Grid, Columns, etc.)
  const applyLayoutPreset = (type: LayoutMode) => {
    if (isViewerMode) return;
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
    if (isViewerMode) return;

    if (templateId) {
      await apiClient.patch(`/api/report-templates/${templateId}/charts/canvas-batch`, {
        layoutMode: 'grid',
        charts: []
      });
      window.location.reload();
    } else {
      window.location.reload();
    }
  };

  const deleteAllCharts = async () => {
    if (isViewerMode) return;
    if (templateId) {
      if (window.confirm('Are you sure you want to delete all charts and insights? This cannot be undone.')) {
        await apiClient.delete(`/api/report-templates/${templateId}/charts`);
        window.location.reload();
      }
    }
  };


  // 6. Add a single AI-generated chart schema into the dashboard
  const addNewChartFromAI = useCallback((schema: ReportChartSchema) => {
    const processed = processData(dataset, [schema], context, fieldSchemas);
    if (!processed.length) return;

    setAllCharts(prev => {
      const newChart = processed[0];
      const colorIndex = prev.length % COLOR_PALETTES.length;
      const defaultW = PROCESSOR_DEFAULTS.LAYOUT_WIDTH;
      const defaultH = PROCESSOR_DEFAULTS.LAYOUT_HEIGHT;
      const newChartHeight = newChart.kind === 'insight' ? 8 : defaultH;

      // Shift existing active charts down to make room at the top
      const nextPrev = prev.map(c => {
        if (visibleChartIds.has(c.id) && c.layout) {
          return {
            ...c,
            layout: {
              ...c.layout,
              y: c.layout.y + newChartHeight
            }
          };
        }
        return c;
      });

      const chartWithLayout: ChartConfig = {
        ...newChart,
        colors: COLOR_PALETTES[colorIndex],
        layout: {
          x: 0,
          y: 0,
          w: defaultW,
          h: newChartHeight,
          i: newChart.id,
        },
      };

      const next = [chartWithLayout, ...nextPrev];
      const nextIds = new Set([newChart.id, ...Array.from(visibleChartIds)]);
      setVisibleChartIds(nextIds);
      triggerAutoSave(next, nextIds, activeLayout);
      return next;
    });

    if (onNewChart) onNewChart(schema);
  }, [dataset, visibleChartIds, activeLayout, triggerAutoSave, onNewChart, context, fieldSchemas]);

  // 7. Add multiple AI-generated charts at once (Scenario 4: report analysis)
  const addMultipleChartsFromAI = useCallback((schemas: ReportChartSchema[]) => {
    if (!schemas.length) return;
    const processed = processData(dataset, schemas, context, fieldSchemas);
    if (!processed.length) return;

    setAllCharts(prev => {
      const defaultW = PROCESSOR_DEFAULTS.LAYOUT_WIDTH;
      const defaultH = PROCESSOR_DEFAULTS.LAYOUT_HEIGHT;

      let maxNewY = 0;
      const newCharts: ChartConfig[] = processed.map((chart, i) => {
        const colorIndex = (prev.length + i) % COLOR_PALETTES.length;
        const h = chart.kind === 'insight' ? 8 : defaultH;
        const y = Math.floor(i / 2) * defaultH;
        if (y + h > maxNewY) {
          maxNewY = y + h;
        }

        return {
          ...chart,
          colors: COLOR_PALETTES[colorIndex],
          layout: {
            x: (i % 2) * defaultW,
            y,
            w: defaultW,
            h,
            i: chart.id,
          },
        };
      });

      const nextPrev = prev.map(c => {
        if (visibleChartIds.has(c.id) && c.layout) {
          return {
            ...c,
            layout: {
              ...c.layout,
              y: c.layout.y + maxNewY
            }
          };
        }
        return c;
      });

      const next = [...newCharts, ...nextPrev];
      const nextIds = new Set([...newCharts.map(c => c.id), ...Array.from(visibleChartIds)]);
      setVisibleChartIds(nextIds);
      triggerAutoSave(next, nextIds, activeLayout);
      return next;
    });
  }, [dataset, visibleChartIds, activeLayout, triggerAutoSave, context, fieldSchemas]);

  // --- VALUE ---
  
  const value = {
    // State
    activeCharts,
    inactiveCharts,
    layoutMode: activeLayout,
    isEditOpen,
    isMounted,
    currentLayouts,
    templateId,
    isViewerMode,
    dataset,

    // Actions
    setEditOpen: setIsEditOpen,
    setLayoutMode: setActiveLayout,
    addChart,
    removeChart,
    updateChartKind,
    addNewChartFromAI,
    addMultipleChartsFromAI,
    updateLayout,
    applyLayoutPreset,
    resetDashboard,
    deleteAllCharts
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

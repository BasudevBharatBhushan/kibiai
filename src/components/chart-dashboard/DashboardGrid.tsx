'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { FiGrid, FiColumns, FiList, FiSidebar, FiRotateCcw } from 'react-icons/fi';
import ChartCard from './ChartCard';
import InsightCard from './InsightCard';
import { processData } from '@/lib/DataProcessor';
import type { ChartConfig, ChartKind, ReportChartSchema } from '@/lib/ChartTypes';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/dashboard.css';

const ResponsiveGridLayout = WidthProvider(Responsive);
const LOCAL_KEY = 'hc_rgl_dashboard_v3';
const LAYOUT_LOCAL_KEY = 'kibiai_dashboard_layout_v1';

//Props
interface DashboardProps {
  initialSchemas?: ReportChartSchema[];
  initialDataset?: any[];
}
export default function Dashboard({ initialSchemas = [], initialDataset = [] }: DashboardProps) {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeLayout, setActiveLayout] = useState<'grid' | 'two-columns' | 'single-row' | 'insight'>('grid');

useEffect(() => {
    setMounted(true);

    if (initialSchemas.length > 0) {
      console.log("Loading charts from API Config...");
      
      const processed = processData(initialDataset, initialSchemas);
      
      const layoutCharts = processed.map((c, i) => ({
        ...c,
        layout: { 
          x: (i % 2) * 6, 
          y: Math.floor(i / 2) * 9, 
          w: 6, 
          h: 9, 
          i: c.id 
        }
      }));
      setCharts(layoutCharts);
    } 
    else {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        setCharts(JSON.parse(raw));
      }
    }

    const rawLayout = localStorage.getItem(LAYOUT_LOCAL_KEY);
    if (rawLayout) setActiveLayout(rawLayout as any);
  }, [initialSchemas]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(charts));
      localStorage.setItem(LAYOUT_LOCAL_KEY, activeLayout);
    }
  }, [charts, mounted, activeLayout]);

  const currentLayouts = useMemo(() => {
    return { lg: charts.map(c => c.layout!) };
  }, [charts]);


  function handleRemove(id: string) {
    setCharts(prev => prev.filter(c => c.id !== id));
  }

  function handleChangeKind(id: string, kind: ChartKind) {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, kind, title: `Sample ${kind} Chart` } : c));
  }

  const handleLayoutChange = useCallback((layout: Layout[]) => {
    setCharts(prev => {
      let changed = false;
      const next = prev.map(c => {
        const l = layout.find(i => i.i === c.id);
        if (l && (l.x !== c.layout?.x || l.y !== c.layout?.y || l.w !== c.layout?.w || l.h !== c.layout?.h)) {
          changed = true;
          return { ...c, layout: { ...l, i: c.id } };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, []);

  function applyLayout(type: typeof activeLayout) {
    setActiveLayout(type);
    setCharts(prev => {
      let sorted = [...prev];
      if (type === 'insight') {
        sorted.sort((a, b) => (b.kind === 'insight' ? 1 : 0) - (a.kind === 'insight' ? 1 : 0));
      }
      
      return sorted.map((c, i) => {
        const l = { ...c.layout! };
        
        if (type === 'grid') { 
          l.w = 6; 
          l.h = 9; 
          l.x = (i % 2) * 6; 
          l.y = Math.floor(i / 2) * 9; 
        }
        if (type === 'two-columns') { 
          l.w = 6; 
          l.h = 14; 
          l.x = (i % 2) * 6; 
          l.y = Math.floor(i / 2) * 14; 
        }
        if (type === 'single-row') { 
          l.w = 12; 
          l.h = 10; 
          l.x = 0; 
          l.y = i * 10; 
        }
        if (type === 'insight') {
          if (c.kind === 'insight') { 
            l.w = 12; l.h = 8; l.x = 0; l.y = i * 8; 
          } else { 
            const offset = sorted.filter(x => x.kind === 'insight').length;
            const ci = i - offset;
            l.w = 6; 
            l.h = 9; 
            l.x = (ci % 2) * 6; 
            l.y = (offset * 8) + Math.floor(ci / 2) * 9; 
          }
        }
        return { ...c, layout: l };
      });
    });
  }

  function handleReset() {
    if (window.confirm("Are you sure? This will discard all changes.")) {
      localStorage.removeItem(LOCAL_KEY);
      localStorage.removeItem(LAYOUT_LOCAL_KEY);
      setActiveLayout('grid');
      
      // Reload fresh data
      const legacy = processData(initialDataset, initialSchemas);
      const defaultCharts = legacy.map((c, i) => ({
        ...c,
        layout: { ...c.layout, x: (i % 2) * 6, y: Math.floor(i / 2) * 9, w: 6, h: 9, i: c.id }
      }));
      setCharts(defaultCharts);
    }
  }


  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center w-full max-w-[1600px] mx-auto p-6">
      
      {/* --- CONTROL BAR --- */}
      <div className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl shadow-sm p-3 mb-6 sticky top-4 z-10">
        

        <div className="flex items-center gap-3">
          {/* RESET BUTTON */}
          <button 
            onClick={handleReset}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all shadow-sm active:scale-95 flex items-center gap-2"
            title="Reset Layout">
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
              className={`layout-btn ${activeLayout === id ? 'layout-btn-active' : 'layout-btn-inactive'}`}
              title={id}>
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>


      <div 
        className="dashboard-area"
        style={{
          backgroundImage: 'linear-gradient(#f1f5f9 1px, transparent 1px), linear-gradient(to right, #f1f5f9 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {charts.length === 0 && (
          <div className="flex h-[400px] items-center justify-center text-slate-400 italic">
            No charts loaded. 
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={currentLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          margin={[10, 10]}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".dragHandle"
        >
          {charts.map(cfg => (
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
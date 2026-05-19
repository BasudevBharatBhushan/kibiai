import type { AIInsightItem, InsightResult } from '@/lib/insights/types';

export type ChartKind = 'line' | 'pie' | 'area' | 'column' | 'donut' | 'insight';


// Data series for charts
export interface ChartDataSeries {
    name: string;
    data: number[];
}

// Chart configuration interface
export interface ChartConfig {
    id: string;
    kind: ChartKind;
    title: string;
    isActive?: boolean;
    supabaseId?: string;

    colors?: string[];

    categories: string[];
    series: ChartDataSeries[];
    insights?: string[];
    insight_results?: any[];
    insight_date_range?: {
      field: string;
      start: string;
      end: string;
    };
    /** Filters applied to this chart's data (after viewer-mode date-filter stripping) */
    filters?: string[];
    /** Date range of the currently selected report, shown in every card's subtitle */
    report_date_range?: {
      field?: string;
      start: string;
      end: string;
    };
    layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string;
  };
}

// Raw data item interface
export interface RawDataItem {
  [key: string]: string | number | undefined;
}

export interface InsightContext {
  reportStart?: string;
  reportEnd?: string;
  /** Human-readable label of the field that drives the report date window */
  reportDateField?: string;
}

// Report Chart Schema Interface
export interface ReportChartSchema {
  pKey: string;                
  chart_title: string;          
  chart_type: string;
  isActive?: string | number | boolean;   
  supabaseId?: string;        
  numerical_field?: string;     
  group_field?: string;        
  subgroup_field?: string;      
  mathematical_aggregation_method?: 'sum' | 'count' | 'average' | 'min' | 'max'; 
  filters?: string[];            
  
  business_insights?: string[];
  /** v3 AI plan items — used to re-execute insights against fresh data */
  insight_items?: AIInsightItem[];
  /** v3 resolved results — persisted at generation time, used as fallback */
  insight_results?: InsightResult[];
  insight_date_range?: {
    field: string;
    start: string;
    end: string;
  };
  response_to_user?: string;
}

export const COLOR_PALETTES = [
  // Palette A: Default Cool (Blues & Teals)
  ['#2caffe', '#544fc5', '#00e272', '#fe6a35', '#6b8abc', '#d568fb'],
  
  // Palette B: Warm & Vivid (Oranges & Reds)
  ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#F7EC09', '#FF4D4D'],
  
  // Palette C: Corporate Dark (Navy & Gold)
  ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#F76F51', '#606C38'],
  
  // Palette D: Pastel (Soft & Clean)
  ['#A18D6D', '#457B9D', '#1D3557', '#FBF3D5', '#E63946', '#B5838D'],
];

import type { AIInsightItem, InsightResult } from '@/lib/insights/types';

export type ChartKind =
  | 'line'
  | 'spline'
  | 'pie'
  | 'area'
  | 'areaspline'
  | 'column'
  | 'bar'
  | 'donut'
  | 'gauge'
  | 'funnel'
  | 'insight';


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
    limit_count?: number;
    sort_order?: 'asc' | 'desc';
    stacking?: 'none' | 'normal' | 'percent';
    target_value?: number;   // for gauge: current goal or hardcoded value
    target_max?: number;     // for gauge: computed max from target_field
    insights?: string[];
    insight_results?: any[];
    insight_date_range?: {
      field: string;
      start: string;
      end: string;
    };
    /** Filters applied to this chart's data (after viewer-mode date-filter stripping) */
    filters?: string[];
    /** Computed (virtual) field definitions — display only, sourced from the AI schema */
    computed_field_meta?: Array<{ name: string; formula: string }>;
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

export interface ComputedChartField {
  name: string;            // virtual column name — use verbatim in numerical_field/numerical_fields
  formula: string;         // arithmetic using dependency names, e.g. "Total Invoice - Payment Total"
  dependencies?: string[]; // field names used in the formula; auto-inferred from data keys if omitted
  type: 'derived';         // row-level only; no aggregate functions allowed
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
  numerical_fields?: string[];          // v2: multi-series array
  /** @deprecated use numerical_fields. Kept for backward-compatibility with persisted v1 charts. */
  numerical_field?: string;
  group_field?: string;
  group_field_time_bucket?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'day_of_week';
  subgroup_field?: string;
  subgroup_field_time_bucket?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'day_of_week';
  stacking?: 'none' | 'normal' | 'percent';
  limit_count?: number;
  sort_order?: 'asc' | 'desc';
  /** @deprecated use aggregation_method. Kept for backward-compatibility with persisted v1 charts. */
  mathematical_aggregation_method?: 'sum' | 'count' | 'average' | 'min' | 'max';
  aggregation_method?: 'sum' | 'count' | 'average' | 'percentage';
  target_field?: string;    // gauge: benchmark field name from schema
  target_value?: number;    // gauge: hardcoded goal value
  filters?: string[];
  computed_field?: ComputedChartField;
  computed_fields?: ComputedChartField[];

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

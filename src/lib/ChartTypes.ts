
export type ChartKind = 'line' | 'pie' | 'area' | 'column' | 'donut' | 'insight';

export interface ChartDataSeries {
    name: string;
    data: number[];
}

export interface ChartConfig {
    id: string;
    kind: ChartKind;
    title: string;
    categories: string[];
    series: ChartDataSeries[];
    insights?: string[];
    layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string; 
  };
}

export interface RawDataItem {
  [key: string]: string | number | undefined;
}

export interface ReportChartSchema {
  pKey: string;                
  chart_title: string;          
  chart_type: string;           
  
  numerical_field?: string;     
  group_field?: string;        
  subgroup_field?: string;      
  mathematical_aggregation_method?: 'sum' | 'count' | 'average' | 'min' | 'max'; 
  filters?: string[];            
  
  business_insights?: string[]; 
  response_to_user?: string;   
}
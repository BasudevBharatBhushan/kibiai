// --- Schema Definitions ---

export interface FieldDef {
  type: string;
  label: string;
  valuelist?: string;
  prefix?: string;
}

export interface TableDef {
  file: string;
  username: string;
  password: string;
  layout: string;
  fields: Record<string, FieldDef>;
}

export interface ReportSetup {
  host: string;
  tables: Record<string, TableDef>;
  relationships: any[]; // relationships: any[] with a proper interface
}

// --- Configuration Definitions (The State) ---

// 1. Database Definition (Joins)
export interface DbDefinition {
  primary_table: string;
  joined_table: string;
  source?: string;
  target?: string;
  join_type: string;
  fetch_order: number;
}

// 2. Report Columns
export interface ReportColumn {
  table: string;
  field: string;
}

// 3. Group By Fields
export interface GroupByField {
  table: string;
  field: string;
  sort_order: 'asc' | 'desc';
  display: Array<{ table: string; field: string }>;
  group_total: Array<{ table: string; field: string }>;
}

// 4. Custom Calculated Fields
export interface CustomCalcField {
  field_name: string;
  label: string;
  format: 'number' | 'currency' | 'percentage';
  formula: string;
  dependencies: string[];
}

// 5. Sorting
export interface SortField {
  field: string;
  sort_order: 'asc' | 'desc';
}

// 6. The Master Config Interface
export interface ReportConfig {
  report_header: string;
  response_to_user: string;
  
  // The arrays/objects
  db_defination: DbDefinition[];
  report_columns: ReportColumn[];
  
  group_by_fields: Record<string, GroupByField>;
  filters: Record<string, Record<string, string>>; 
  date_range_fields: Record<string, Record<string, string>>;
  body_sort_order: SortField[];
  summary_fields: string[];
  custom_calculated_fields: CustomCalcField[];
}
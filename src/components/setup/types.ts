export interface FieldConfig {
  type: "text" | "number" | "date";
  label: string;
  prefix?: string;
  suffix?: string;
  valuelist?: string;
}

export interface TableConfig {
  file: string;
  username: string;
  password: string;
  layout: string | null;
  fields: Record<string, FieldConfig>;
}

export interface Relationship {
  primary_table: string;
  joined_table: string;
  source: string;
  target: string;
}

export interface SetupConfig {
  host: string;
  data_fetching_protocol: "data-api" | "o-data-api";
  tables: Record<string, TableConfig>;
  relationships: Relationship[];
}

import { z } from "zod";
export interface ReportSetupJson {
  host?: string;
  data_fetching_protocol?: string;
  tables: Record<
    string,
    {
      file: string;
      username: string;
      password: string;
      layout?: string | null;
      fields?: Record<
        string,
        {
          label: string;
          prefix?: string;
          suffix?: string;
        }
      >;
    }
  >;
  relationships?: Array<{
    primary_table: string;
    joined_table: string;
    source?: string;
    target?: string;
  }>;
}

export interface ReportConfigJson {
  db_defination: Array<{
    primary_table: string;
    joined_table?: string;
    source?: string;
    target?: string;
    fetch_order: number;
    join_type?: "left" | "inner";
  }>;
  report_columns?: Array<{
    table: string;
    field: string;
  }>;
  group_by_fields?: Record<
    string,
    {
      table: string;
      field: string;
      display?: Array<{ table: string; field: string }>;
      group_total?: Array<{ table: string; field: string }>;
      sort_order?: "asc" | "desc";
    }
  >;
  date_range_fields?: Record<string, Record<string, string>>;
  filters?: Record<string, Record<string, any>>;
  body_sort_order?: Array<{
    field: string;
    sort_order: "asc" | "desc";
  }>;
  summary_fields?: string[];
  report_header?: string;
  response_to_user?: string;
  [key: string]: any;
}

export interface FetchOrderDataset {
  order: number;
  data: Array<{
    PrimaryKey: string;
    [key: string]: any;
  }>;
}

export interface StitchResult {
  BodyField: Record<string, any>[];
}

export interface ApiResponse {
  status: "ok" | "error";
  detail?: string;
  nextJSError?: any;
  report_structure_json?: any;
  stitch_result?: StitchResult;
  processing_logs?: string[];
}

export const reportSetupSchema = z.object({
  host: z.string().optional(),
  data_fetching_protocol: z.string().optional(),
  tables: z.record(
    z.string(),
    z.object({
      file: z.string(),
      username: z.string(),
      password: z.string(),
      layout: z.string().nullable().optional(),
      fields: z

        .record(
          z.string(),
          z.object({
            label: z.string(),
            prefix: z.string().optional(),
            suffix: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
  relationships: z
    .array(
      z.object({
        primary_table: z.string(),
        joined_table: z.string(),
        source: z.string().optional(),
        target: z.string().optional(),
      })
    )
    .optional(),
});

export const reportConfigSchema = z.object({
  db_defination: z.array(
    z.object({
      primary_table: z.string(),
      joined_table: z.string().optional(),
      source: z.string().optional(),
      target: z.string().optional(),
      fetch_order: z.number(),
    })
  ),
  report_columns: z
    .array(
      z.object({
        table: z.string(),
        field: z.string(),
      })
    )
    .optional(),
  group_by_fields: z
    .record(
      z.string(),
      z.object({
        table: z.string(),
        field: z.string(),
        display: z
          .array(
            z.object({
              table: z.string(),
              field: z.string(),
            })
          )
          .optional(),
        group_total: z
          .array(
            z.object({
              table: z.string(),
              field: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional(),
  date_range_fields: z
    .record(z.string(), z.record(z.string(), z.string()))
    .optional(),
  filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  body_sort_order: z
    .array(
      z.object({
        field: z.string(),
        sort_order: z.string(),
      })
    )
    .optional(),
  summary_fields: z.array(z.string()).optional(),
  report_header: z.string().optional(),
  response_to_user: z.string().optional(),
});

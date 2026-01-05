import { z } from "zod";

// Base chart schema for common fields
const BaseChartSchema = {
  response_to_user: z.string(),
  chart_title: z.string().min(1),
  filters: z.array(z.string()).optional(),
};

// Bar Chart Schema
export const BarChartSchema = z
  .object({
    response_to_user: z.string(),

    numerical_field: z.string().min(1),
    group_field: z.string().min(1),

    aggregation_method: z.enum(["sum", "average", "count"]),

    chart_type: z.literal("bar"),

    chart_title: z.string().min(1),

    filters: z.array(z.string()).optional(),
  })
  .strict();

export type BarChart = z.infer<typeof BarChartSchema>;

// Pie Chart Schema
export const PieChartSchema = z
  .object({
    ...BaseChartSchema,

    numerical_field: z.string().min(1),
    group_field: z.string().min(1),

    aggregation_method: z.enum(["sum", "count"]),

    chart_type: z.literal("pie"),
  })
  .strict();

export type PieChart = z.infer<typeof PieChartSchema>;

// Line Chart Schema
export const LineChartSchema = z
  .object({
    ...BaseChartSchema,

    numerical_field: z.string().min(1),

    group_field: z.string().min(1), // usually time-based
    subgroup_field: z.string().optional(),

    aggregation_method: z.enum(["sum", "average", "count"]),

    chart_type: z.literal("line"),
  })
  .strict();

export type LineChart = z.infer<typeof LineChartSchema>;

// Area Chart Schema
export const AreaChartSchema = z
  .object({
    ...BaseChartSchema,

    numerical_field: z.string().min(1),
    group_field: z.string().min(1),
    subgroup_field: z.string().optional(),

    aggregation_method: z.enum(["sum", "average", "count"]),

    chart_type: z.literal("area"),
  })
  .strict();

export type AreaChart = z.infer<typeof AreaChartSchema>;

// Doughnut Chart Schema
export const DoughnutChartSchema = z
    .object({
        ...BaseChartSchema,
        numerical_field: z.string().min(1),
        group_field: z.string().min(1),
        aggregation_method: z.enum(["sum", "count"]),
        chart_type: z.literal("doughnut"),
    })
    .strict();

export type DoughnutChart = z.infer<typeof DoughnutChartSchema>;

// Business Insight Schema
export const BusinessInsightSchema = z
  .object({
    response_to_user: z.string().min(1),
    business_insights: z.array(z.string().min(1)),
  })
  .strict();

export type BusinessInsight = z.infer<typeof BusinessInsightSchema>;

// Chart Suggestion Schema
export const ChartSuggestionSchema = z
  .object({
    response_to_user: z.string().min(1),
    chart_suggestions: z.array(z.string().min(1)).min(1).max(5),
  })
  .strict();

export type ChartSuggestion = z.infer<typeof ChartSuggestionSchema>;

// Report Analysis Schema
export const ReportAnalysisChartSchema = z.object({
  numerical_field: z.string().min(1),
  group_field: z.string().min(1),
  aggregation_method: z.enum(["sum", "average", "count"]),
  chart_type: z.enum([
    "bar",
    "line",
    "pie",
    "doughnut",
    "area",
  ]),
  chart_title: z.string().min(1),
  filters: z.array(z.string()).optional(),
});

export const ReportAnalysisSchema = z.object({
  response_to_user: z.string().min(1),

  responses: z
    .array(ReportAnalysisChartSchema)
    .length(3, "Report analysis must contain exactly 3 charts"),

  business_insights: z
    .array(z.string().min(10))
    .min(1, "At least one business insight is required"),
});

export type ReportAnalysis = z.infer<typeof ReportAnalysisSchema>;

// Comparison Line Chart Schema
export const ComparisonLineChartSchema = z.object({
  response_to_user: z.string().min(1),

  chart_title: z.string().min(1),

  chart_type: z.literal("line"),

  numerical_field: z.string().min(1),

  group_field: z.string().min(1),

  subgroup_field: z.string().min(1),

  aggregation_method: z.enum(["sum", "count"]),

  filters: z
    .array(z.string().min(1))
    .min(2, "Comparison charts require filters"),
}).strict();


export type ComparisonLineChart = z.infer<
  typeof ComparisonLineChartSchema
>;


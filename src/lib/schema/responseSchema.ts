import { z } from "zod";
import { 
  VALIDATION_LIMITS, 
  AGGREGATION_METHODS, 
  PIE_AGGREGATION_METHODS 
} from "@/constants/analytics";

// Base chart schema for common fields
const BaseChartSchema = {
  response_to_user: z.string(),
  chart_title: z.string().min(1),
  filters: z.array(z.string()).optional(),
};

// --- CARTESIAN CHARTS (Bar, Line, Area) ---

// Bar Chart Schema
export const BarChartSchema = z
  .object({
    ...BaseChartSchema,
    numerical_field: z.string().min(1),
    group_field: z.string().min(1),
    aggregation_method: z.enum(AGGREGATION_METHODS),
    chart_type: z.literal("bar"),
  })
  .strict();

export type BarChart = z.infer<typeof BarChartSchema>;

// Line Chart Schema
export const LineChartSchema = z
  .object({
    ...BaseChartSchema,
    numerical_field: z.string().min(1),
    group_field: z.string().min(1), // usually time-based
    subgroup_field: z.string().optional(),
    aggregation_method: z.enum(AGGREGATION_METHODS),
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
    aggregation_method: z.enum(AGGREGATION_METHODS),
    chart_type: z.literal("area"),
  })
  .strict();

export type AreaChart = z.infer<typeof AreaChartSchema>;

// --- RADIAL CHARTS (Pie, Doughnut) ---

// Pie Chart Schema
export const PieChartSchema = z
  .object({
    ...BaseChartSchema,
    numerical_field: z.string().min(1),
    group_field: z.string().min(1),
    aggregation_method: z.enum(PIE_AGGREGATION_METHODS),
    chart_type: z.literal("pie"),
  })
  .strict();

export type PieChart = z.infer<typeof PieChartSchema>;

// Doughnut Chart Schema
export const DoughnutChartSchema = z
    .object({
        ...BaseChartSchema,
        numerical_field: z.string().min(1),
        group_field: z.string().min(1),
        aggregation_method: z.enum(PIE_AGGREGATION_METHODS),
        chart_type: z.literal("doughnut"),
    })
    .strict();

export type DoughnutChart = z.infer<typeof DoughnutChartSchema>;

// --- INSIGHTS & ANALYSIS ---

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
    chart_suggestions: z
      .array(z.string().min(1))
      .min(VALIDATION_LIMITS.SUGGESTION_MIN)
      .max(VALIDATION_LIMITS.SUGGESTION_MAX),
  })
  .strict();

export type ChartSuggestion = z.infer<typeof ChartSuggestionSchema>;

// Report Analysis Schema
// Helper schema for individual charts within an analysis report
export const ReportAnalysisChartSchema = z.object({
  numerical_field: z.string().min(1),
  group_field: z.string().min(1),
  aggregation_method: z.enum(AGGREGATION_METHODS),
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
    .length(
      VALIDATION_LIMITS.REPORT_ANALYSIS_COUNT, 
      `Report analysis must contain exactly ${VALIDATION_LIMITS.REPORT_ANALYSIS_COUNT} charts`
    ),

  business_insights: z
    .array(z.string().min(VALIDATION_LIMITS.INSIGHT_MIN_LENGTH))
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
  aggregation_method: z.enum(PIE_AGGREGATION_METHODS), 
  filters: z
    .array(z.string().min(1))
    .min(2, "Comparison charts require at least 2 filters"),
}).strict();

export type ComparisonLineChart = z.infer<typeof ComparisonLineChartSchema>;
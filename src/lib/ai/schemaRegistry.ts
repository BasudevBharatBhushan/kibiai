import { 
   BarChartSchema, 
   PieChartSchema, 
   LineChartSchema, 
   AreaChartSchema, 
   BusinessInsightSchema, 
   DoughnutChartSchema,
   ChartSuggestionSchema,
   ReportAnalysisSchema,
   ComparisonLineChartSchema
} from "@/lib/schema/responseSchema";

// Registry mapping chart types to their Zod schemas
export const ChartSchemaRegistry = {
   bar: BarChartSchema,
   pie: PieChartSchema,
   line: LineChartSchema,
   area: AreaChartSchema,
   doughnut: DoughnutChartSchema,
} as const;

export type SupportedChartType = keyof typeof ChartSchemaRegistry;

// Registry mapping insight types to their Zod schemas
export const InsightSchemaRegistry = {
  business_insight: BusinessInsightSchema,
  chart_suggestions: ChartSuggestionSchema,
  report_analysis: ReportAnalysisSchema,
  comparison_line: ComparisonLineChartSchema,
} as const;
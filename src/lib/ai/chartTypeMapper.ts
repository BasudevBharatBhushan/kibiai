import { ChartKind } from "@/lib/types/ChartTypes";
import { AIChartType } from "@/lib/types/aiTypes";
import { CHART_TYPE_MAP } from "@/constants/analytics";

// Map AI chart types to UI ChartKind
export function mapAIChartTypeToUIKind(chartType: AIChartType): ChartKind {
  const mapped = CHART_TYPE_MAP[chartType];
  
  if (!mapped) {
    throw new Error(`Unsupported chart type: ${chartType}`);
  }
  
  return mapped as ChartKind;
}

import { ChartKind } from "@/lib/charts/ChartTypes";
import { AIChartType } from "@/lib/ai/aiTypes";

// Map AI chart types to UI ChartKind
export function mapAIChartTypeToUIKind(
  chartType: AIChartType
): ChartKind {
  switch (chartType) {
    case "bar":
      return "column";

    case "line":
      return "line";

    case "pie":
      return "pie";

    case "doughnut":
      return "donut";

    case "area":
      return "area";

    default:
      throw new Error(`Unsupported chart type: ${chartType}`);
  }
}

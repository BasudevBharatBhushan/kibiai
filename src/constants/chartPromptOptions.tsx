import { BarChart3, Lightbulb, FileText, TrendingUp } from "lucide-react";
import { PromptOption } from "@/components/chat/ModularChatbot";

/**
 * Suggested prompt options for the Charts Copilot.
 * Displayed as clickable cards when the chatbot has no messages.
 */
export const CHART_PROMPT_OPTIONS: PromptOption[] = [
  {
    title: "Chart Suggestions",
    description: "Suggest some chart types for the data analysis based on available fields.",
    icon: <BarChart3 className="w-5 h-5 text-indigo-500" />,
  },
  {
    title: "Business Insights",
    description: "Generate comprehensive business insights based on the report data and chart summary.",
    icon: <Lightbulb className="w-5 h-5 text-indigo-500" />,
  },
  {
    title: "Report Analysis",
    description: "Provide a full report analysis with multiple chart perspectives and insights.",
    icon: <FileText className="w-5 h-5 text-indigo-500" />,
  },
  {
    title: "Comparison Chart",
    description: "Create a comparison chart to compare key metrics across different categories or statuses.",
    icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
  },
];

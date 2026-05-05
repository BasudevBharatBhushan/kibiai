import { BarChart3, TrendingUp } from "lucide-react";
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
    title: "Comparison Chart",
    description: "Create a comparison chart to compare key metrics across different categories or statuses.",
    icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
  },
];

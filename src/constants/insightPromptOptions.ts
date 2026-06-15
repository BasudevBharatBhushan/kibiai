import React from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Zap,
  Activity,
  Target,
} from "lucide-react";
import type { PromptOption } from "@/components/chat/ModularChatbot";

/**
 * Suggested prompt chips for the Business Insight Assistant chatbot.
 * Equivalent of CHART_PROMPT_OPTIONS for the Chart Copilot.
 */
export const INSIGHT_PROMPT_OPTIONS: PromptOption[] = [
  {
    title: "Generate Insights",
    description: "Generate business insights from my report schema",
    icon: React.createElement(Sparkles, { size: 16 }),
  },
  {
    title: "Trend Analysis",
    description: "What trends can you identify from the available fields?",
    icon: React.createElement(TrendingUp, { size: 16 }),
  },
  {
    title: "Risk Indicators",
    description: "Identify risk indicators from this data schema",
    icon: React.createElement(AlertTriangle, { size: 16 }),
  },
  {
    title: "Efficiency Metrics",
    description: "Show me efficiency metrics I can track",
    icon: React.createElement(Zap, { size: 16 }),
  },
  {
    title: "Anomaly Detection",
    description: "Identify anomaly patterns in this schema",
    icon: React.createElement(Activity, { size: 16 }),
  },
  {
    title: "Opportunities",
    description: "What opportunity metrics can be computed from this schema?",
    icon: React.createElement(Target, { size: 16 }),
  },
];

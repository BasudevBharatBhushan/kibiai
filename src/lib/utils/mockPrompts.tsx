
import { BarChart3, Users, PieChart } from "lucide-react";

//MOCK SUGGESTED PROMPTS
export const SUGGESTED_PROMPTS = [
  {
    title: "Sales Analysis",
    description: "Analyze the sales trends for Q3 compared to the previous year.",
    icon: <BarChart3 className="w-5 h-5 text-indigo-500" />
  },
  {
    title: "Lead Engagement",
    description: "Summarize the top leads engaged this week and their status.",
    icon: <Users className="w-5 h-5 text-indigo-500" />
  },
  {
    title: "Revenue Report",
    description: "Generate a breakdown of revenue by region for last month.",
    icon: <PieChart className="w-5 h-5 text-indigo-500" />
  }
];
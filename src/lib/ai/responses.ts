import { openai } from "./client";
import { createConversation } from "./conversations";
import { ChartIntent } from "./intent";
import {
  ChartSchemaRegistry,
  SupportedChartType,
  InsightSchemaRegistry,
} from "../schema/schemaRegistry";
import { 
  AI_CONFIG, 
  PROMPT_INSTRUCTIONS, 
  AI_ERROR_MESSAGES 
} from "@/constants/analytics";

// Parameters for sending a user prompt to the AI
type SendUserPromptParams = {
  instruction_set: string;
  conversation_id?: string | null;
  conversation_metadata?: Record<string, any>;
  predefined_prompt?: string;
  user_prompt: string;
  field_names?: string;
  report_insights?: string;
  chart_summary?: string; 
  intent: ChartIntent;
};

// Send the user's prompt to the AI and handle the response based on intent
export async function sendUserPrompt({
  instruction_set,
  conversation_id,
  conversation_metadata,
  predefined_prompt = "",
  user_prompt,
  field_names,
  report_insights,
  chart_summary,
  intent,
}: SendUserPromptParams) {
  let conversationId = conversation_id;

  // Create a new conversation if none exists
  if (!conversationId) {
    conversationId = await createConversation(conversation_metadata);
  }

  // Build context block based on provided information
  let contextBlock = "";
  if (field_names) contextBlock += `\nFieldName: ${field_names}`;
  if (report_insights) contextBlock += `\nReport Insights: ${report_insights}`;
  if (chart_summary) {
    contextBlock += `\nChart Summary: ${chart_summary}`;
  }
  if (intent === "report_analysis") {
    contextBlock += `\n${PROMPT_INSTRUCTIONS.REPORT_ANALYSIS}`;
  }

  if (intent === "comparison_chart") {
    contextBlock += `\n${PROMPT_INSTRUCTIONS.COMPARISON_CHART}`;
  }

  // Construct the final prompt for the AI
  const finalPrompt = `
  ${predefined_prompt}

  User Request:
  ${user_prompt}

  ${contextBlock}
  `.trim();

  // Send the prompt to the AI
  const response = await openai.responses.create({
    model: AI_CONFIG.MODEL,
    instructions: instruction_set,
    conversation: conversationId,
    store: true,
    input: [{ role: "user", content: finalPrompt }],
    text: { format: AI_CONFIG.RESPONSE_FORMAT },
  });

  // Parse and validate the AI's response based on the detected intent
  const rawText = response.output_text;
  if (!rawText) throw new Error("Empty AI response");

  const parsedOutput = JSON.parse(rawText);

  switch (intent) {
    // Handle Chart Generation Intent
    case "chart_generation": {
      const chartType = parsedOutput.chart_type as SupportedChartType;
      const schema = ChartSchemaRegistry[chartType];

      if (!schema) {
        throw new Error(AI_ERROR_MESSAGES.UNSUPPORTED_CHART(chartType));
      }

      const validatedChart = schema.parse(parsedOutput);

      return {
        conversation_id: conversationId,
        chart: validatedChart,
      };
    }
    // Handle Business Insight Intent
    case "business_insight": {
      const schema = InsightSchemaRegistry.business_insight; 
      const result = schema.safeParse(parsedOutput);

      if (!result.success) {
        return {
          conversation_id: conversationId,
          response_to_user:
            AI_ERROR_MESSAGES.VALIDATION_FAIL.INSIGHTS,
          business_insights: [],
        };
      }

    return {
      conversation_id: conversationId,
      ...result.data,
    };
  }
    // Handle Chart Suggestions Intent
    case "chart_suggestions": {
      const schema = InsightSchemaRegistry.chart_suggestions;

      const result = schema.safeParse(parsedOutput);

      if (!result.success) {
        console.error("Chart Suggestion Zod validation failed:", result.error.format());
        return {
          conversation_id: conversationId,
          response_to_user:
            AI_ERROR_MESSAGES.VALIDATION_FAIL.SUGGESTIONS,
          chart_suggestions: [],
        };
      }

      return {
        conversation_id: conversationId,
        ...result.data,
      };
    }

    // Handle Report Analysis Intent
    case "report_analysis": {
      const schema = InsightSchemaRegistry.report_analysis;
      const result = schema.safeParse(parsedOutput);

      if (!result.success) {
        console.error(
          "Report Analysis Zod validation failed:",
          result.error.format()
        );

        return {
          conversation_id: conversationId,
          response_to_user:
            AI_ERROR_MESSAGES.VALIDATION_FAIL.REPORT_ANALYSIS,
          responses: [],
          business_insights: [],
        };
      }

      return {
        conversation_id: conversationId,
        ...result.data,
      };
    }

    // Handle Comparison Chart Intent
    case "comparison_chart": {
      if (!parsedOutput.chart) {
        throw new Error("Expected chart object missing for comparison chart");
      }

      const schema = InsightSchemaRegistry.comparison_line;
      const result = schema.safeParse(parsedOutput.chart);

      if (!result.success) {
        console.error("Comparison chart validation failed:", result.error.format());

        return {
          conversation_id: conversationId,
          response_to_user:
            AI_ERROR_MESSAGES.VALIDATION_FAIL.COMPARISON,
        };
      }

      return {
        conversation_id: conversationId,
        chart: result.data,
      };
    }
    // Handle Unknown Intent
    default:
      throw new Error(AI_ERROR_MESSAGES.UNSUPPORTED_INTENT);
  }
}

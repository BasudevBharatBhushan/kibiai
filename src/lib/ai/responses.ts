import { openai } from "./client";
import { createConversation } from "./conversations";
import { ChartIntent } from "./intent";
import {
  ChartSchemaRegistry,
  SupportedChartType,
  InsightSchemaRegistry,
} from "./schemaRegistry";

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
    contextBlock += `
  Return a JSON object with:
  - response_to_user
  - responses (exactly 3 chart configurations)
  - business_insights (an array of actionable insights)
  Do NOT omit business_insights.
  `;
  }

  if (intent === "comparison_chart") {
    contextBlock += `
  This is a comparison-based chart.
  STRICT REQUIREMENTS:
  - subgroup_field is REQUIRED
  - Use ONLY line charts
  - aggregation_method must be "sum" or "count"
  - filters are REQUIRED
  - Always include:
    - "<subgroup_field>: notEmpty"
    - "<numerical_field>: >0"

  Return a SINGLE chart configuration JSON.
  `;
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
    model: "gpt-4.1",
    instructions: instruction_set,
    conversation: conversationId,
    store: true,
    input: [{ role: "user", content: finalPrompt }],
    text: { format: { type: "json_object" } },
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
        throw new Error(`Unsupported chart type: ${chartType}`);
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
            "I could not generate valid business insights. Please ensure the report summary and chart summary are provided and try again.",
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
            "I could not generate valid chart suggestions. Please provide the required field names.",
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
            "I could not generate a valid report analysis. Please ensure sufficient report and chart context is provided.",
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
            "I could not generate a valid comparison chart. Please ensure all required fields are present.",
        };
      }

      return {
        conversation_id: conversationId,
        chart: result.data,
      };
    }
    // Handle Unknown Intent
    default:
      throw new Error("Unsupported intent");
  }
}

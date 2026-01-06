// 1. Intent Detection Keywords
export const INTENT_KEYWORDS = {
  comparison: [
    "compare", 
    "comparison", 
    "breakdown by", 
    "status by", 
    "trend by", 
    "grouped by"
  ],
  suggestion: [
    "suggest", 
    "recommend"
  ],
  insight: [
    "business insight", 
    "business insights", 
    "analyze the report"
  ],
  analysis: [
    "report analysis", 
    "analyze report"
  ],
  generation: [
    "chart", 
    "bar", 
    "line", 
    "pie", 
    "doughnut", 
    "area"
  ],
} as const;

// 2. Data Processing & Layout
export const PROCESSOR_DEFAULTS = {
  LAYOUT_WIDTH: 6,
  LAYOUT_HEIGHT: 9,
  SUBGROUP_DEFAULT: 'default',
  NUMERIC_CLEAN_REGEX: /[^0-9.-]/g,
} as const;

// 3. Schema Validation Limits
export const VALIDATION_LIMITS = {
  SUGGESTION_MIN: 1,
  SUGGESTION_MAX: 5,
  REPORT_ANALYSIS_COUNT: 3,
  INSIGHT_MIN_LENGTH: 10,
} as const;

// 4. Aggregation Methods (Tuple for Zod schemas)
export const AGGREGATION_METHODS = ["sum", "average", "count"] as const;
export const PIE_AGGREGATION_METHODS = ["sum", "count"] as const;

// 5. Chart Type Mapping (Legacy/AI -> UI)
export const CHART_TYPE_MAP: Record<string, string> = {
  bar: 'column', 
  doughnut: 'donut',
  pie: 'pie',
  line: 'line',
  area: 'area'
};

// 6. API Routes
export const API_ROUTES = {
  DASHBOARD_SAVE: '/api/dashboard',
  CHART_SAVE: '/api/charts/save',
} as const;

// 7. AI Configuration
export const AI_CONFIG = {
  MODEL: "gpt-4.1", 
  CONVERSATION_LIMIT: 50, 
  RESPONSE_FORMAT: { type: "json_object" } as const,
} as const;

// 8. Prompt Instructions
export const PROMPT_INSTRUCTIONS = {
  REPORT_ANALYSIS: `
    Return a JSON object with:
    - response_to_user
    - responses (exactly 3 chart configurations)
    - business_insights (an array of actionable insights)
    Do NOT omit business_insights.
  `,
  COMPARISON_CHART: `
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
  `,
} as const;

// 9. AI Error Messages (User Facing)
export const AI_ERROR_MESSAGES = {
  EMPTY_RESPONSE: "Empty AI response",
  UNSUPPORTED_INTENT: "Unsupported intent",
  UNSUPPORTED_CHART: (type: string) => `Unsupported chart type: ${type}`,
  
  VALIDATION_FAIL: {
    INSIGHTS: "I could not generate valid business insights. Please ensure the report summary and chart summary are provided and try again.",
    SUGGESTIONS: "I could not generate valid chart suggestions. Please provide the required field names.",
    REPORT_ANALYSIS: "I could not generate a valid report analysis. Please ensure sufficient report and chart context is provided.",
    COMPARISON: "I could not generate a valid comparison chart. Please ensure all required fields are present.",
  }
} as const;

// 10. Insight Display Configuration
export const INSIGHT_CONFIG = {
  SEPARATOR: ' - ',
  BULLET_COLOR: 'bg-blue-500',
} as const;

// 11. Chat Configuration
export const CHAT_CONFIG = {
  BOT_NAME: "KiBi-AI",
  WELCOME_MESSAGE: "Welcome to KiBi-AI! Please select an available prompt from the suggestion button or enter a new prompt to generate a report.",
  SYSTEM_INSTRUCTION: "You are a helpful assistant.",
  DEFAULT_PREDEFINED: "Answer in plain English.",
  SOURCE_METADATA: "demo-ui",
} as const;
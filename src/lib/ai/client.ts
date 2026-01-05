import OpenAI from "openai";

// Initialize OpenAI client with API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

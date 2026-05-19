import OpenAI from "openai";
import { requireEnv } from "@/lib/utils/utility";

const apiKey = requireEnv("OPENAI_API_KEY");

export const openai = new OpenAI({
  apiKey: apiKey,
});

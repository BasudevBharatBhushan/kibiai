import { openai } from "./client";
import { createConversation } from "./conversations";

type SendUserPromptParams = {
  instruction_set: string;
  conversation_id?: string | null;
  conversation_metadata?: Record<string, any>;
  predefined_prompt?: string;
  user_prompt: string;
};

export async function sendUserPrompt({
  instruction_set,
  conversation_id,
  conversation_metadata,
  predefined_prompt = "",
  user_prompt,
}: SendUserPromptParams) {
  let conversationId = conversation_id;

  if (!conversationId) {
    conversationId = await createConversation(conversation_metadata);
  }

  const finalPrompt = `${predefined_prompt}\n${user_prompt}`;

  const response = await openai.responses.create({
    model: "gpt-4.1",
    instructions: instruction_set,
    conversation: conversationId,
    store: true,
    input: [
      {
        role: "user",
        content: finalPrompt,
      },
    ],
    text: {
      format: { type: "json_object" },
    },
  });

  const outputText = response.output_text || response.output?.[0] || null;

  return {
    conversation_id: conversationId,
    response: outputText,
  };
}

import { apiClient } from "@/utils/apiClient";

const BASE_URL = "/api/conversations";

// Payload structure for sending a message
export interface SendMessagePayload {
  instruction_set: string;
  conversation_id?: string | null;
  conversation_metadata?: Record<string, unknown>;
  predefined_prompt?: string;
  user_prompt: string;
}

// Send a message to the conversation API
export async function sendMessage(payload: SendMessagePayload) {
  return apiClient.post<{
    conversation_id: string;
    response: string | null;
  }>(BASE_URL, payload);
}

// Fetch an existing conversation by ID
export async function getConversation(conversationId: string) {
  return apiClient.get<
    {
      id: string;
      role: "user" | "assistant";
      content: { type: string; text?: string }[];
      created_at: number;
    }[]
  >(`${BASE_URL}/${conversationId}`);
}

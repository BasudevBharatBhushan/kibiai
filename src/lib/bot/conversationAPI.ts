const BASE_URL = '/api/conversations';

// Payload structure for sending a message
export interface SendMessagePayload {
  instruction_set: string;
  conversation_id?: string | null;
  conversation_metadata?: Record<string, any>;
  predefined_prompt?: string;
  user_prompt: string;
}

// Send a message to the conversation API
export async function sendMessage(payload: SendMessagePayload) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to send message");
  }

  return res.json() as Promise<{
    conversation_id: string;
    response: string | null;
  }>;
}

// Fetch an existing conversation by ID
export async function getConversation(conversationId: string) {
  const res = await fetch(`${BASE_URL}/${conversationId}`);

  if (!res.ok) {
    throw new Error("Failed to fetch conversation");
  }

  return res.json() as Promise<
    {
      id: string;
      role: "user" | "assistant";
      content: { type: string; text?: string }[];
      created_at: number;
    }[]
  >;
}
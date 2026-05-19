import { AI_CONFIG } from "../../constants/analytics";
import { openai } from "./client";

// Create a new conversation 
export async function createConversation(metadata?: Record<string, any>) {
  const conversation = await openai.conversations.create({
    metadata,
  });

  return conversation.id;
}

// Fetch conversation messages by ID
export async function fetchConversation(conversationId: string) {
  const items = await openai.conversations.items.list(conversationId, {
   limit: AI_CONFIG.CONVERSATION_LIMIT,
  });

  return items.data.map((item: any) => ({
    id: item.id,
    role: item.role,
    content: item.content,
    created_at: item.created_at,
  }));
}

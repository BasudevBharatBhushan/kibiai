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
    limit: 50,
  });

  return items.data.map((item: any) => ({
    id: item.id,
    role: item.role,
    content: item.content,
    created_at: item.created_at,
  }));
}

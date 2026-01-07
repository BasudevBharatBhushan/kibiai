import { NextResponse } from "next/server";
import { fetchConversation } from "@/lib/ai/conversations";

// GET /api/conversations/[conversationId]
export async function GET(
  req: Request,
  context: { params: Promise<{ conversationId: string }> }
) {
  // Fetch conversation messages by ID
  try {
    const { conversationId } = await context.params;

    const conversation = await fetchConversation(conversationId);

    return NextResponse.json(conversation);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

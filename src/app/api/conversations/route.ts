import { NextResponse } from "next/server";
import { sendUserPrompt } from "@/lib/ai/responses";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      instruction_set,
      conversation_id,
      conversation_metadata,
      predefined_prompt,
      user_prompt,
    } = body;

    const result = await sendUserPrompt({
      instruction_set,
      conversation_id,
      conversation_metadata,
      predefined_prompt,
      user_prompt,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

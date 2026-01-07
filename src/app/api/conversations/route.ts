import { NextResponse } from "next/server";
import { detectIntent } from "@/lib/ai/detectIntent";
import { sendUserPrompt } from "@/lib/ai/responses";

// POST /api/conversations
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      instruction_set,
      conversation_id,
      conversation_metadata,
      predefined_prompt,
      user_prompt,
      field_names,
      report_insights,
      chart_summary,
    } = body;

    if (!user_prompt) {
      return NextResponse.json(
        { error: "user_prompt is required" },
        { status: 400 }
      );
    }

    const intent = detectIntent(user_prompt);

    if (intent === "unknown") {
      return NextResponse.json({
        response_to_user:
          "I can help generate charts, business insights, chart suggestions, or report analysis. Please clarify your request.",
      });
    }


    const result = await sendUserPrompt({
      instruction_set,
      conversation_id,
      conversation_metadata,
      predefined_prompt,
      user_prompt,
      field_names,
      report_insights,
      chart_summary,
      intent,
    });

    // Return the conversation ID and response
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

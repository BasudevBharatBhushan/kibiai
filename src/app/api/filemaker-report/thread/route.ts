import { NextRequest, NextResponse } from "next/server";
import { fmSignIn, fmVerifySession, fmSetRecordById, fmSignOut } from "@/lib/utils/filemaker";

const FM_LAYOUT = "MultiTableReport Filtered Datas";

export async function POST(req: NextRequest) {
  let token: string | null = null;
  let kibiai_server: string = 'kibiz.smtech.cloud';

  try {
    const { recordId, threadId, username, password, server } = await req.json();

    if (!recordId || !threadId) {
      return NextResponse.json(
        { status: "error", detail: "recordId and threadId are required" },
        { status: 400 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { status: "error", detail: "username and password are required for database access" },
        { status: 400 }
      );
    }

    kibiai_server = server ?? kibiai_server;

    // Step 1: Sign in
    token = await fmSignIn(username, password, kibiai_server);
    if (!token) {
      throw new Error("Failed to authenticate with FileMaker");
    }

    // Step 2: Update the record context
    await fmSetRecordById(
      FM_LAYOUT,
      recordId,
      {
        OpenAI_AssistantThreadID: threadId
      },
      token,
      kibiai_server
    );

    return NextResponse.json({ status: "ok", detail: "Thread ID synced successfully" }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", detail: errorMessage },
      { status: 500 }
    );
  } finally {
    if (token) {
      try {
        await fmSignOut(token, kibiai_server);
      } catch (e) {
        console.error("Failed to sign out FileMaker session:", e);
      }
    }
  }
}

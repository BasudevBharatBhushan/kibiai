import { NextResponse } from "next/server";
import { getSession } from "@/utils/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      user: session 
    });
  } catch (err: any) {
    console.error("Session validation error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

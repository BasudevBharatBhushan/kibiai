import { NextResponse } from "next/server";
import { deleteSession } from "@/utils/auth";

export async function POST() {
  await deleteSession();
  return NextResponse.json({ success: true });
}

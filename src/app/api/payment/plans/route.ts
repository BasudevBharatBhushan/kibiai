import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.stripe.com/v1/products?active=true", {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.STRIPE_SECRET_KEY}:`
        ).toString("base64")}`,
      },
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || "Failed to fetch plans");

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

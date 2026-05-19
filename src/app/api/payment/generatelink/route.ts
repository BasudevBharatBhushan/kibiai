import { NextResponse } from "next/server";

const STRIPE_BASE = "https://api.stripe.com/v1";

export async function POST(req: Request) {
  try {
    const { priceId, quantity = 1 } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { success: false, error: "Missing priceId" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", quantity.toString());
    params.append("allow_promotion_codes", "true");

    const res = await fetch(`${STRIPE_BASE}/payment_links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.STRIPE_SECRET_KEY}:`
        ).toString("base64")}`,
      },
      body: params,
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || "Failed to generate payment link");

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

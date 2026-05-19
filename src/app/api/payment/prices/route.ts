import { NextResponse } from "next/server";

const STRIPE_BASE = "https://api.stripe.com/v1";

export async function GET() {
  try {
    const res = await fetch(
      `${STRIPE_BASE}/prices?active=true&expand[]=data.product`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.STRIPE_SECRET_KEY}:`
          ).toString("base64")}`,
        },
      }
    );

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || "Failed to fetch prices");

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { unitAmount, currency, interval, productId } = await req.json();

    const body = new URLSearchParams({
      unit_amount: unitAmount,
      currency,
      "recurring[interval]": interval,
      product: productId,
    });

    const res = await fetch(`${STRIPE_BASE}/prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.STRIPE_SECRET_KEY}:`
        ).toString("base64")}`,
      },
      body,
    });

    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error?.message || "Failed to create price");

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

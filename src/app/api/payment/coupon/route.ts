import { NextResponse } from "next/server";

const STRIPE_BASE = "https://api.stripe.com/v1";

export async function GET() {
  try {
    const res = await fetch(
      `${STRIPE_BASE}/promotion_codes?active=true&expand[]=data.coupon`,
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
      throw new Error(data.error?.message || "Failed to fetch coupons");

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
    const { promoCode, percentOff, maxRedemptions, expiresAt } =
      await req.json();

    if (!promoCode || !percentOff) {
      return NextResponse.json(
        { success: false, error: "promoCode and percentOff required" },
        { status: 400 }
      );
    }

    // Step 1 → Create Coupon
    const couponParams = new URLSearchParams({
      percent_off: percentOff.toString(),
      duration: "once",
    });

    if (maxRedemptions)
      couponParams.append("max_redemptions", maxRedemptions.toString());
    if (expiresAt)
      couponParams.append(
        "redeem_by",
        Math.floor(new Date(expiresAt).getTime() / 1000).toString()
      );

    const couponRes = await fetch(`${STRIPE_BASE}/coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.STRIPE_SECRET_KEY}:`
        ).toString("base64")}`,
      },
      body: couponParams,
    });

    const coupon = await couponRes.json();
    if (!couponRes.ok)
      throw new Error(coupon.error?.message || "Failed to create coupon");

    // Step 2 → Create Promotion Code
    // Step 2 → Create Promotion Code
    const promoParams = new URLSearchParams({
      code: promoCode,
      "promotion[type]": "coupon",
      "promotion[coupon]": coupon.id,
      active: "true",
    });
    if (maxRedemptions)
      promoParams.append("max_redemptions", maxRedemptions.toString());
    if (expiresAt)
      promoParams.append(
        "expires_at",
        Math.floor(new Date(expiresAt).getTime() / 1000).toString()
      );

    const promoRes = await fetch(`${STRIPE_BASE}/promotion_codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.STRIPE_SECRET_KEY}:`
        ).toString("base64")}`,
      },
      body: promoParams,
    });

    const promotionCode = await promoRes.json();
    if (!promoRes.ok)
      throw new Error(
        promotionCode.error?.message || "Failed to create promotion code"
      );

    return NextResponse.json({
      success: true,
      data: { coupon, promotionCode },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

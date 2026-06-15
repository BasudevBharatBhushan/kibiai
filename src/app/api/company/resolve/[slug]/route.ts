import { NextResponse } from "next/server";
import { CompanyService } from "@/services/company.service";

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug is required" }, { status: 400 });
    }

    const company = await CompanyService.resolveCompanyBySlug(slug);

    if (!company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      company
    }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/company/resolve error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

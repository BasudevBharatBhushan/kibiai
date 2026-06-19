import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

export async function POST(req: Request) {
  try {
    // 1. Verify Authentication (Platform Admin only)
    const session = await getSession();

    if (!session || session.accountType !== 'platform_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized. Platform Admin only." }, { status: 401 });
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const companyId = formData.get("companyId") as string;

    if (!file || !companyId) {
      return NextResponse.json({ success: false, error: "File and companyId are required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 3. Check if company exists
    const { data: company, error: companyFetchError } = await adminClient
      .from("companies")
      .select("company_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (companyFetchError || !company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    // 4. Upload to Supabase Storage
    const fileExtension = file.name.split('.').pop();
    const fileName = `${companyId}_${Date.now()}.${fileExtension}`;
    const filePath = `logos/${fileName}`;

    const { data: uploadData, error: uploadError } = await adminClient
      .storage
      .from("company-logos")
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ success: false, error: "Failed to upload to storage" }, { status: 500 });
    }

    // 5. Get Public URL
    const { data: urlData } = adminClient
      .storage
      .from("company-logos")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // 6. Update Companies Table
    const { error: updateError } = await adminClient
      .from("companies")
      .update({ company_logo: publicUrl })
      .eq("company_id", companyId);

    if (updateError) {
      return NextResponse.json({ success: false, error: "Failed to update company logo URL" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logoUrl: publicUrl
    });

  } catch (err: any) {
    console.error("POST /api/company/logo error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

/**
 * Insight Thread Route — ST-12
 *
 * PATCH /api/report-templates/[template_id]/insight-thread
 *
 * Persists insight_conversation_id and/or insight_results for a report template.
 * Mirrors the existing chart-thread PATCH route pattern.
 * Both fields are optional so the client can update one or both in a single call.
 */

const patchBodySchema = z.object({
  insight_conversation_id: z.string().nullable().optional(),
  insight_results: z.array(z.unknown()).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "template_id is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    console.log("[PATCH /insight-thread] Body:", JSON.stringify(body, null, 2));
    
    const parsed = patchBodySchema.safeParse(body);

    if (!parsed.success) {
      console.error("[PATCH /insight-thread] Zod Validation Error:", parsed.error.message);
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    // Build update payload — only include fields that were sent
    const updatePayload: Record<string, unknown> = {
      updated_on: new Date().toISOString(),
    };

    if (parsed.data.insight_conversation_id !== undefined) {
      updatePayload.insight_conversation_id = parsed.data.insight_conversation_id;
    }
    if (parsed.data.insight_results !== undefined) {
      updatePayload.insight_results = parsed.data.insight_results;
    }

    console.log("[PATCH /insight-thread] Update Payload:", JSON.stringify(updatePayload, null, 2));

    // Resolve the template's company_id (platform admins may not have session.companyId)
    const supabase = createAdminClient();
    let ownerQuery = supabase
      .from("report_templates")
      .select("company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      ownerQuery = ownerQuery.eq("company_id", session.companyId);
    }

    const { data: templateOwner, error: ownerError } = await ownerQuery.maybeSingle();

    if (ownerError || !templateOwner) {
      console.error("[PATCH /insight-thread] Template not found or company mismatch");
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const targetCompanyId = templateOwner.company_id;
    const { data, error } = await supabase
      .from("report_templates")
      .update(updatePayload)
      .eq("report_template_id", template_id)
      .eq("company_id", targetCompanyId)
      .select("report_template_id, insight_conversation_id")
      .single();

    if (error) {
      console.error("[PATCH /insight-thread] Supabase Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error("[PATCH /insight-thread] No data returned (Template not found or company mismatch)");
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error(
      "[PATCH /api/report-templates/[template_id]/insight-thread] Unexpected Error:",
      err
    );
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

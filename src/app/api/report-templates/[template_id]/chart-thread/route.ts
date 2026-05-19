import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

const patchBodySchema = z.object({
  chart_conversation_id: z.string().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.companyId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { template_id } = await params;
    const body = await req.json();
    const parsed = patchBodySchema.safeParse(body);

    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "template_id is required" },
        { status: 400 }
      );
    }

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("report_templates")
      .update({
        chart_conversation_id: parsed.data.chart_conversation_id,
        updated_on: new Date().toISOString(),
      })
      .eq("report_template_id", template_id)
      .eq("company_id", session.companyId)
      .select("report_template_id, chart_conversation_id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Template not found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    console.error("[PATCH /api/report-templates/[template_id]/chart-thread]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { extractBodyRows, extractFieldNamesFromReportData } from "@/lib/charts/supabaseAdapters";
import { normalizePivotMetadata } from "@/lib/pivot/pivotConfigGenerator";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

const aggregationSchema = z.enum(["sum", "avg", "count", "min", "max"]);

const pivotMetadataSchema = z.object({
  rows: z.array(z.string()),
  columns: z.array(z.string()),
  values: z.array(
    z.object({
      field: z.string(),
      aggregation: aggregationSchema,
    })
  ),
});

const patchBodySchema = z.object({
  metadata: pivotMetadataSchema,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "template_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let templateQuery = supabase
      .from("report_templates")
      .select(
        "report_template_id, report_template_name, report_template_data_json, report_template_pivot_metadata_json, company_id"
      )
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      templateQuery = templateQuery.eq("company_id", session.companyId);
    }

    const { data: template, error } = await templateQuery.single();

    if (error || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const rows = extractBodyRows(template.report_template_data_json);
    const fieldNames = extractFieldNamesFromReportData(template.report_template_data_json);

    return NextResponse.json({
      success: true,
      data: {
        template_id: template.report_template_id,
        template_name: template.report_template_name,
        rows,
        fieldNames,
        pivot_metadata: normalizePivotMetadata(template.report_template_pivot_metadata_json),
      },
    });
  } catch (err: unknown) {
    console.error("[GET /api/report-templates/[template_id]/pivot]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json(
        { success: false, error: "template_id is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const supabase = createAdminClient();
    let ownerQuery = supabase
      .from("report_templates")
      .select("report_template_id, company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      ownerQuery = ownerQuery.eq("company_id", session.companyId);
    }

    const { data: template, error: fetchError } = await ownerQuery.single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const targetCompanyId = template.company_id;
    const pivotMetadata = normalizePivotMetadata(parsed.data.metadata);

    const { error: updateError } = await supabase
      .from("report_templates")
      .update({ report_template_pivot_metadata_json: pivotMetadata })
      .eq("report_template_id", template_id)
      .eq("company_id", targetCompanyId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        pivot_metadata: pivotMetadata,
      },
    });
  } catch (err: unknown) {
    console.error("[PATCH /api/report-templates/[template_id]/pivot]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

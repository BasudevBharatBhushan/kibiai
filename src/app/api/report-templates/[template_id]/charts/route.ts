import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  buildChartTemplateInsertPayload,
  extractBodyRows,
  extractFieldNamesFromReportData,
  normalizeChartTemplates,
} from "@/lib/charts/supabaseAdapters";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";

const chartSchema = z.object({
  pKey: z.string().min(1),
  chart_title: z.string().min(1),
  chart_type: z.string().min(1),
  isActive: z.union([z.boolean(), z.number(), z.string()]).optional(),
  numerical_field: z.string().optional(),
  group_field: z.string().optional(),
  subgroup_field: z.string().optional(),
  mathematical_aggregation_method: z
    .enum(["sum", "count", "average", "min", "max"])
    .optional(),
  filters: z.array(z.string()).optional(),
  business_insights: z.array(z.string()).optional(),
  insight_plan: z.any().optional(),
  insight_results: z.array(z.any()).optional(),
  insight_date_range: z.object({
    field: z.string(),
    start: z.string(),
    end: z.string(),
  }).optional(),
  response_to_user: z.string().optional(),
});

const postBodySchema = z.object({
  chart: chartSchema,
  layoutMode: z.string().optional(),
});

export async function GET(
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

    const supabase = createAdminClient();
    let templateQuery = supabase
      .from("report_templates")
      .select(
        "report_template_id, report_template_name, report_template_data_json, report_template_insight, report_template_config_json, report_template_setup_json, chart_conversation_id, insight_conversation_id, insight_results, company_id"
      )
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      templateQuery = templateQuery.eq("company_id", session.companyId);
    }

    const { data: template, error: templateError } = await templateQuery.single();

    // The full preview structure is needed by the admin chart-builder so it can
    // optionally render a side-by-side report preview alongside the dashboard.

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const targetCompanyId = template.company_id;

    let chartsQuery = supabase
      .from("chart_templates")
      .select(
        "chart_template_id, chart_template_name, chart_template_type, chart_template_setup_json, chart_template_dataset_json, chart_template_canvas_state"
      )
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      chartsQuery = chartsQuery.eq("company_id", session.companyId);
    } else {
      chartsQuery = chartsQuery.eq("company_id", targetCompanyId);
    }

    const { data: chartTemplates, error: chartsError } = await chartsQuery
      .order("created_on", { ascending: true });

    if (chartsError) {
      return NextResponse.json(
        { success: false, error: chartsError.message },
        { status: 500 }
      );
    }

    const normalized = normalizeChartTemplates(chartTemplates);
    const rows = extractBodyRows(template.report_template_data_json);
    const fieldNames = extractFieldNamesFromReportData(
      template.report_template_data_json
    );

    return NextResponse.json({
      success: true,
      data: {
        template_id: template.report_template_id,
        template_name: template.report_template_name,
        chart_conversation_id: template.chart_conversation_id ?? null,
        insight_conversation_id: template.insight_conversation_id ?? null,
        insight_results: template.insight_results ?? null,
        report_template_config_json: template.report_template_config_json ?? null,
        report_template_setup_json: template.report_template_setup_json ?? null,
        report_template_data_json: template.report_template_data_json ?? null,
        report_insight: template.report_template_insight ?? null,
        fieldNames,
        rows,
        ...normalized,
      },
    });

  } catch (err: unknown) {
    console.error("[GET /api/report-templates/[template_id]/charts]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let templateOwnerQuery = supabase
      .from("report_templates")
      .select("report_template_id, company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      templateOwnerQuery = templateOwnerQuery.eq("company_id", session.companyId);
    }

    const { data: template, error: templateError } = await templateOwnerQuery.single();

    if (templateError || !template) {
      return NextResponse.json(
        { success: false, error: "Template not found" },
        { status: 404 }
      );
    }

    const targetCompanyId = template.company_id;

    const insertPayload = buildChartTemplateInsertPayload({
      companyId: targetCompanyId,
      reportTemplateId: template_id,
      chart: parsed.data.chart,
      layoutMode: parsed.data.layoutMode,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("chart_templates")
      .insert(insertPayload)
      .select(
        "chart_template_id, chart_template_name, chart_template_type, chart_template_setup_json, chart_template_dataset_json, chart_template_canvas_state"
      )
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        {
          success: false,
          error: insertError?.message || "Failed to create chart template",
        },
        { status: 500 }
      );
    }

    const normalized = normalizeChartTemplates([inserted]);

    return NextResponse.json(
      {
        success: true,
        data: {
          chart_template_id: inserted.chart_template_id,
          schema: normalized.schemas[0] ?? null,
          canvasState: normalized.canvasState[0] ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("[POST /api/report-templates/[template_id]/charts]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const supabase = createAdminClient();

    // Resolve template's company_id before deleting (needed for scoping writes)
    let ownerQuery = supabase
      .from("report_templates")
      .select("company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      ownerQuery = ownerQuery.eq("company_id", session.companyId);
    }

    const { data: templateOwner, error: ownerError } = await ownerQuery.maybeSingle();

    if (ownerError || !templateOwner) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied" },
        { status: 404 }
      );
    }

    const targetCompanyId = templateOwner.company_id;
    
    // 1. Delete all charts for this report template
    const { error: deleteChartsError } = await supabase
      .from("chart_templates")
      .delete()
      .eq("report_template_id", template_id)
      .eq("company_id", targetCompanyId);

    if (deleteChartsError) {
      throw deleteChartsError;
    }

    // 2. Clear AI copilot conversation IDs and insight results from report_templates
    const { error: updateTemplateError } = await supabase
      .from("report_templates")
      .update({
        chart_conversation_id: null,
        insight_conversation_id: null,
        insight_results: null,
        updated_on: new Date().toISOString(),
      })
      .eq("report_template_id", template_id)
      .eq("company_id", targetCompanyId);

    if (updateTemplateError) {
      throw updateTemplateError;
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[DELETE /api/report-templates/[template_id]/charts]", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

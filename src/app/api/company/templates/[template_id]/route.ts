import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

interface RouteParams {
  params: Promise<{ template_id: string }>;
}

// PATCH /api/company/templates/[template_id] — Edit template name
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { report_template_name } = body;
    if (!report_template_name || typeof report_template_name !== "string" || !report_template_name.trim()) {
      return NextResponse.json({ success: false, error: "report_template_name is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify ownership and check if exists
    let fetchQuery = adminClient
      .from("report_templates")
      .select("report_template_id, company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      fetchQuery = fetchQuery.eq("company_id", session.companyId);
    }

    const { data: existing, error: fetchError } = await fetchQuery.single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied." },
        { status: 404 }
      );
    }

    // Update name
    const { data: updated, error: updateError } = await adminClient
      .from("report_templates")
      .update({
        report_template_name: report_template_name.trim(),
        updated_on: new Date().toISOString(),
      })
      .eq("report_template_id", template_id)
      .select("report_template_id, report_template_name, report_template_status, updated_on")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to update template name." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    console.error(`PATCH /api/company/templates/[template_id] error:`, err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/company/templates/[template_id] — Hard delete template (with manual cascade delete)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify ownership and check if exists
    let fetchQuery = adminClient
      .from("report_templates")
      .select("report_template_id, company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      fetchQuery = fetchQuery.eq("company_id", session.companyId);
    }

    const { data: existing, error: fetchError } = await fetchQuery.single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied." },
        { status: 404 }
      );
    }

    // Step 1: Find all report_ids of reports belonging to this template
    const { data: reports, error: reportsError } = await adminClient
      .from("reports")
      .select("report_id")
      .eq("report_template_id", template_id);

    if (reportsError) {
      throw new Error(`Failed to fetch associated reports: ${reportsError.message}`);
    }

    const reportIds = (reports || []).map((r) => r.report_id);

    // Step 2: Find all chart_template_ids belonging to this template
    const { data: chartTemplates, error: chartTemplatesError } = await adminClient
      .from("chart_templates")
      .select("chart_template_id")
      .eq("report_template_id", template_id);

    if (chartTemplatesError) {
      throw new Error(`Failed to fetch associated chart templates: ${chartTemplatesError.message}`);
    }

    const chartTemplateIds = (chartTemplates || []).map((ct) => ct.chart_template_id);

    // Step 3: Delete from charts referencing the reports or chart templates
    // First nullify any duplicate_of_chart_id to avoid constraint violations during deleting
    if (reportIds.length > 0) {
      await adminClient
        .from("charts")
        .update({ duplicate_of_chart_id: null })
        .in("report_id", reportIds);
    }
    if (chartTemplateIds.length > 0) {
      await adminClient
        .from("charts")
        .update({ duplicate_of_chart_id: null })
        .in("chart_template_id", chartTemplateIds);
    }

    // Now delete the charts
    if (reportIds.length > 0) {
      const { error: deleteChartsByReportError } = await adminClient
        .from("charts")
        .delete()
        .in("report_id", reportIds);

      if (deleteChartsByReportError) {
        throw new Error(`Failed to delete charts by report_id: ${deleteChartsByReportError.message}`);
      }
    }

    if (chartTemplateIds.length > 0) {
      const { error: deleteChartsByTemplateError } = await adminClient
        .from("charts")
        .delete()
        .in("chart_template_id", chartTemplateIds);

      if (deleteChartsByTemplateError) {
        throw new Error(`Failed to delete charts by chart_template_id: ${deleteChartsByTemplateError.message}`);
      }
    }

    // Step 4: Delete from reports
    if (reportIds.length > 0) {
      const { error: deleteReportsError } = await adminClient
        .from("reports")
        .delete()
        .in("report_id", reportIds);

      if (deleteReportsError) {
        throw new Error(`Failed to delete reports: ${deleteReportsError.message}`);
      }
    }

    // Step 5: Delete from chart_templates
    if (chartTemplateIds.length > 0) {
      const { error: deleteChartTemplatesError } = await adminClient
        .from("chart_templates")
        .delete()
        .in("chart_template_id", chartTemplateIds);

      if (deleteChartTemplatesError) {
        throw new Error(`Failed to delete chart templates: ${deleteChartTemplatesError.message}`);
      }
    }

    // Step 6: Delete from user_template_permissions
    const { error: deletePermissionsError } = await adminClient
      .from("user_template_permissions")
      .delete()
      .eq("report_template_id", template_id);

    if (deletePermissionsError) {
      throw new Error(`Failed to delete user template permissions: ${deletePermissionsError.message}`);
    }

    // Step 7: Delete from report_template_versions
    const { error: deleteVersionsError } = await adminClient
      .from("report_template_versions")
      .delete()
      .eq("report_template_id", template_id);

    if (deleteVersionsError) {
      throw new Error(`Failed to delete report template versions: ${deleteVersionsError.message}`);
    }

    // Step 8: Finally delete the report_templates record
    const { error: deleteTemplateError } = await adminClient
      .from("report_templates")
      .delete()
      .eq("report_template_id", template_id);

    if (deleteTemplateError) {
      throw new Error(`Failed to delete the report template: ${deleteTemplateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Template and all related contents deleted successfully"
    });
  } catch (err: any) {
    console.error(`DELETE /api/company/templates/[template_id] error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

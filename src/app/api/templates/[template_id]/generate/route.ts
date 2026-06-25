import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { createAdminClient } from "@/utils/supabase/server";
import { sanitizeJsonForPostgres } from "@/lib/utils/sanitizeJsonForPostgres";
import { z } from "zod";
import type { NestedReport } from "@/lib/sql/structureAdapter";

// ── Zod Schema ────────────────────────────────────────────────────────────────
const generateBodySchema = z.object({
  runtime_filters: z
    .object({
      date_range_fields: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      filters: z.record(z.string(), z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  report_header: z.string().optional(),
  report_name: z.string().optional(), // kept for backwards-compat
  persist_to_template: z.boolean().optional(),
  config_json: z.record(z.string(), z.any()).optional(),
});

// ── POST /api/templates/[template_id]/generate ───────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    // 1. Auth
    const session = await getSession();
    if (!session || (session.accountType !== "platform_admin" && !session.companyId)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    if (!template_id) {
      return NextResponse.json({ success: false, error: "template_id is required" }, { status: 400 });
    }

    // 2. Validate body
    const body = await req.json();
    const parsed = generateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }

    const { runtime_filters, report_header, config_json } = parsed.data;

    // 3. Fetch template config from Supabase (company-scoped for regular users only)
    const supabase = createAdminClient();
    let templateQuery = supabase
      .from("report_templates")
      .select("report_template_setup_json, setup_id, report_template_config_json, report_template_name, company_id")
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      templateQuery = templateQuery.eq("company_id", session.companyId);
    }

    const { data: template, error: fetchError } = await templateQuery.single();

    if (fetchError || !template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    // Resolve the authoritative company_id from the template (critical for platform admins)
    const targetCompanyId = template.company_id;

    let setupJson = template.report_template_setup_json as any;
    const isLocalEmpty = !setupJson || 
                         (typeof setupJson === "object" && Object.keys(setupJson).length === 0) ||
                         (setupJson.tables && Object.keys(setupJson.tables).length === 0);

    // If local setup is empty or has no tables, but we have a linked setup_id, fetch from library
    if (isLocalEmpty && template.setup_id) {
      const { data: reusableSetup, error: setupError } = await supabase
        .from("report_template_setups")
        .select("setup_json")
        .eq("setup_id", template.setup_id)
        .maybeSingle();

      if (!setupError && reusableSetup) {
        setupJson = reusableSetup.setup_json;
      }
    }

    if (!setupJson || (typeof setupJson === "object" && Object.keys(setupJson).length === 0)) {
      return NextResponse.json(
        { success: false, error: "Template setup is not complete. Please run the Setup Wizard first." },
        { status: 400 }
      );
    }

    const templateConfig = config_json ?? template.report_template_config_json;

    if (!templateConfig) {
      return NextResponse.json(
        { success: false, error: "Template configuration is missing. Please configure the report first." },
        { status: 400 }
      );
    }

    // 4. Merge runtime filters into config (runtime-only — never persisted)
    const configJson = {
      ...(templateConfig as any),
      ...(report_header ? { report_header } : {}),
      ...(runtime_filters?.date_range_fields !== undefined
        ? { date_range_fields: runtime_filters.date_range_fields }
        : {}),
      ...(runtime_filters?.filters !== undefined
        ? { filters: runtime_filters.filters }
        : {}),
    };

    // 5. Delegate to the appropriate engine based on data_source_type.
    //    SQL setups (data_source_type === 'sql') route to the SQL engine.
    //    All other setups (FileMaker, no discriminator) route to the existing
    //    FM engine — the FM path is byte-for-byte identical to before.
    const baseUrl = req.nextUrl.origin;
    const isSql = (setupJson as Record<string, unknown>)?.data_source_type === "sql";
    const engineUrl = isSql
      ? `${baseUrl}/api/sql-report/generate`
      : `${baseUrl}/api/generate-report`;

    const sqlGroupCount = isSql
      ? Object.keys((configJson as Record<string, unknown>)?.group_by_fields ?? {}).length
      : 0;
    const sqlViewMode = sqlGroupCount > 0 ? "collapsed" : "expand_all";

    const engineBody = isSql
      ? JSON.stringify({
          report_setup: setupJson,
          report_config: configJson,
          view_mode: sqlViewMode,
        })
      : JSON.stringify({ report_setup: setupJson, report_config: configJson });

    // Forward the session cookie so the engine route can authenticate.
    const cookieHeader = req.headers.get("cookie") ?? "";

    const engineRes = await fetch(engineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: engineBody,
    });

    if (!engineRes.ok) {
      const errJson = await engineRes.json().catch(() => null);
      const errText = errJson?.detail || errJson?.error || await engineRes.text();
      console.error("[generate] engine error:", errText);
      return NextResponse.json(
        { success: false, error: errText || "Report engine failed to generate the report." },
        { status: 500 }
      );
    }

    const engineResult = await engineRes.json();

    // Both FM and SQL engines use status === 'ok'; FM also requires report_structure_json.
    // SQL engine may return report_structure_json as null for stub modes (drilldown / expand_all).
    if (engineResult.status !== "ok") {
      console.error("[generate] engine result error:", engineResult.detail || engineResult.error);
      return NextResponse.json(
        { success: false, error: engineResult.detail || engineResult.error || "Engine returned no report data." },
        { status: 500 }
      );
    }

    // SQL reports (nested !== null) always return report_structure_json from the engine.
    // For non-SQL (FM) reports, require report_structure_json.
    const nestedReport: NestedReport | null = (engineResult.nested as NestedReport) ?? null;

    if (!engineResult.report_structure_json && !nestedReport) {
      console.error("[generate] engine result error: missing report_structure_json");
      return NextResponse.json(
        { success: false, error: engineResult.detail || engineResult.error || "Engine returned no report data." },
        { status: 500 }
      );
    }

    const reportStructureJson = sanitizeJsonForPostgres(
      engineResult.report_structure_json ?? []
    );
    const persistedConfigJson = sanitizeJsonForPostgres(configJson);

    // Cap flat SQL reports (no groups, flatRows present) to 3000 rows.
    const nestedToSave: NestedReport | null = (() => {
      if (!nestedReport) return null;
      if (
        nestedReport.flatRows &&
        nestedReport.groups.length === 0 &&
        nestedReport.flatRows.length > 3000
      ) {
        return { ...nestedReport, flatRows: nestedReport.flatRows.slice(0, 3000) };
      }
      return nestedReport;
    })();

    // 6. Extract report heading from TitleHeader for use as report name
    const titleHeaderItem = Array.isArray(reportStructureJson)
      ? reportStructureJson.find((i: any) => i && "TitleHeader" in i)
      : null;
    const reportHeading: string =
      titleHeaderItem?.TitleHeader?.MainHeading ||
      template.report_template_name ||
      "Report";

    const { persist_to_template } = parsed.data;

    // 7. Look up the actual users.user_id (FK target) from the users table
    //    session.accountId = auth_accounts.account_id, NOT users.user_id
    let generatedByUserId: string | null = null;
    if (session.accountId && targetCompanyId) {
      const { data: userRow } = await supabase
        .from("users")
        .select("user_id")
        .eq("account_id", session.accountId)
        .eq("company_id", targetCompanyId)
        .maybeSingle();
      generatedByUserId = userRow?.user_id ?? null;
    }

    let savedReportId: string | null = null;
    let savedVersionId: string | null = null;

    const templateDataToSave = nestedToSave
      ? { report_structure_json: reportStructureJson, nested_report: nestedToSave }
      : reportStructureJson;

    if (persist_to_template) {
      // ── ADMIN CONFIGURATOR: persist preview + create a template version ──────
      const { data: updatedTemplate, error: updateError } = await supabase
        .from("report_templates")
        .update({
          report_template_config_json: persistedConfigJson,
          report_template_data_json: templateDataToSave,
          updated_on: new Date().toISOString(),
        })
        .eq("report_template_id", template_id)
        .eq("company_id", targetCompanyId)
        .select("report_template_id")
        .single();

      if (updateError || !updatedTemplate) {
        console.error("[generate] persist error:", updateError);
        return NextResponse.json(
          { success: false, error: updateError?.message || "Failed to save generated report preview to template." },
          { status: 500 }
        );
      }

      // Get next version number
      const { data: maxVersionRow } = await supabase
        .from("report_template_versions")
        .select("version_number")
        .eq("report_template_id", template_id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (maxVersionRow?.version_number ?? 0) + 1;

      const { data: versionRow, error: versionError } = await supabase
        .from("report_template_versions")
        .insert({
          report_template_id: template_id,
          company_id: targetCompanyId,
          version_number: nextVersion,
          config_json: persistedConfigJson,
          preview_data_json: templateDataToSave,
          changed_by_user_id: generatedByUserId,
        })
        .select("version_id")
        .single();

      if (versionError) {
        console.error("[generate] version insert error:", versionError.message);
      } else {
        savedVersionId = versionRow?.version_id ?? null;
      }
    } else {
      // ── USER GENERATE: create a reports record (history) ───────────────────
      const userGenerateTemplateData = nestedToSave
        ? { report_structure_json: reportStructureJson, stitch_result: null, nested_report: nestedToSave }
        : reportStructureJson;

      const { data: updatedTemplate, error: updateTemplateError } = await supabase
        .from("report_templates")
        .update({
          report_template_data_json: userGenerateTemplateData,
          updated_on: new Date().toISOString(),
        })
        .eq("report_template_id", template_id)
        .eq("company_id", targetCompanyId)
        .select("report_template_id")
        .single();

      if (updateTemplateError || !updatedTemplate) {
        console.error("[generate] template data persist error:", updateTemplateError);
        return NextResponse.json(
          { success: false, error: updateTemplateError?.message || "Failed to save generated report data to template." },
          { status: 500 }
        );
      }

      const reportDataToSave = nestedToSave
        ? { report_structure_json: reportStructureJson, nested_report: nestedToSave }
        : reportStructureJson;

      const { data: saved, error: saveError } = await supabase
        .from("reports")
        .insert({
          company_id: targetCompanyId,
          report_template_id: template_id,
          report_name: reportHeading,
          report_config_json: persistedConfigJson,
          report_data_json: reportDataToSave,
          generated_by_user_id: generatedByUserId,
        })
        .select("report_id")
        .single();

      if (saveError) {
        // Non-fatal — log but still return the report data so the user sees results
        console.error("[generate] auto-save error:", saveError.message, saveError.details, saveError.hint);
      } else {
        savedReportId = saved?.report_id ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        report_structure_json: reportStructureJson,
        report_name: reportHeading,
        report_id: savedReportId,
        version_id: savedVersionId,
      },
    });
  } catch (err: any) {
    console.error("[POST /api/templates/[id]/generate]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Report generation failed" },
      { status: 500 }
    );
  }
}

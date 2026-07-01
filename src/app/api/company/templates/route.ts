import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

// POST /api/company/templates — Create a new Draft report template
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { module_id, report_template_name, company_id: providedCompanyId, setup_id } = body;
    const company_id = providedCompanyId || session.companyId;

    if (!module_id || !report_template_name || !company_id) {
      return NextResponse.json(
        { success: false, error: "module_id and report_template_name are required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Fetch snapshot if setup_id is provided
    let snapshotJson = {};
    if (setup_id) {
      const { data: reusableSetup } = await adminClient
        .from("report_template_setups")
        .select("setup_json")
        .eq("setup_id", setup_id)
        .maybeSingle();
      
      if (reusableSetup?.setup_json) {
        snapshotJson = reusableSetup.setup_json;
      }
    }

    // 2. Look up the user_id via account_id from users table
    const { data: userRecord } = await adminClient
      .from("users")
      .select("user_id")
      .eq("account_id", session.accountId)
      .eq("company_id", company_id)
      .maybeSingle();

    const created_by_user_id = userRecord?.user_id || null;

    const { data: template, error } = await adminClient
      .from("report_templates")
      .insert({
        company_id,
        module_id,
        report_template_name,
        created_by_user_id,
        report_template_status: "Draft",
        report_template_setup_json: snapshotJson,
        setup_id: setup_id || null,
        version_number: 1,
      })
      .select(
        "report_template_id, report_template_name, report_template_status, module_id, created_on, setup_id"
      )
      .single();

    if (error || !template) {
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/company/templates error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// GET /api/company/templates?company_id=uuid — List templates for a company
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const company_id = searchParams.get("company_id") || session.companyId;

    if (!company_id) {
      return NextResponse.json(
        { success: false, error: "company_id is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: templates, error } = await adminClient
      .from("report_templates")
      .select(
        `report_template_id, report_template_name, report_template_status,
         version_number, created_on, updated_on, module_id, setup_id,
         report_template_setup_json, report_template_config_json,
         modules(module_name, module_code)`
      )
      .eq("company_id", company_id)
      .order("created_on", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Compute has_setup / has_config flags — strip raw JSON blobs before returning
    const templatesWithFlags = (templates || []).map((t: any) => {
      const { report_template_setup_json, report_template_config_json, ...rest } = t;

      // Determine source type based on setup JSON
      let source_type: "filemaker" | "sql" | null = null;
      if (report_template_setup_json && Object.keys(report_template_setup_json).length > 0) {
        source_type = report_template_setup_json.data_source_type === "sql" ? "sql" : "filemaker";
      }

      return {
        ...rest,
        has_setup: (t.setup_id !== null) || (report_template_setup_json !== null && Object.keys(report_template_setup_json || {}).length > 0),
        has_config: report_template_config_json !== null && Object.keys(report_template_config_json || {}).length > 0,
        source_type,
      };
    });

    return NextResponse.json({ success: true, templates: templatesWithFlags });
  } catch (err: any) {
    console.error("GET /api/company/templates error:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

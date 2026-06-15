import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { getSession } from "@/utils/auth";

interface RouteParams {
  params: Promise<{ template_id: string }>;
}

// GET /api/company/templates/[template_id]/setup — Fetch template + setup json
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    let query = adminClient
      .from("report_templates")
      .select(
        `report_template_id, report_template_name, report_template_status,
         report_template_setup_json, setup_id, version_number, updated_on,
         module_id, modules(module_name, module_code)`
      )
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      query = query.eq("company_id", session.companyId);
    }

    const { data: template, error } = await query.single();

    if (error || !template) {
      return NextResponse.json(
        { success: false, error: "Template not found or access denied." },
        { status: 404 }
      );
    }

    // If template has a linked setup_id, fetch that setup and merge it
    if (template.setup_id) {
      const { data: reusableSetup, error: setupError } = await adminClient
        .from("report_template_setups")
        .select("setup_json, setup_name")
        .eq("setup_id", template.setup_id)
        .maybeSingle();

      if (!setupError && reusableSetup) {
        // Merge reusable setup into the template response
        // Usually, the reusable setup should be the primary source if linked
        template.report_template_setup_json = reusableSetup.setup_json;
        (template as any).reusable_setup_name = reusableSetup.setup_name;
      }
    }

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    console.error(`GET /api/company/templates/[template_id]/setup error:`, err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/company/templates/[template_id]/setup — Save setup JSON
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { setup_json } = body;

    if (!setup_json) {
      return NextResponse.json({ success: false, error: "setup_json is required" }, { status: 400 });
    }

    // Validate required top-level keys
    if (
      !setup_json.host ||
      !setup_json.data_fetching_protocol ||
      typeof setup_json.tables !== "object" ||
      !Array.isArray(setup_json.relationships)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid setup_json structure. Must include: host, data_fetching_protocol, tables (object), relationships (array).",
        },
        { status: 422 }
      );
    }

    const adminClient = createAdminClient();

    // Verify ownership before updating
    let fetchQuery = adminClient
      .from("report_templates")
      .select("report_template_id, report_template_status, company_id")
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

    const { data: updated, error: updateError } = await adminClient
      .from("report_templates")
      .update({
        report_template_setup_json: setup_json,
        setup_id: null,
        updated_on: new Date().toISOString(),
      })
      .eq("report_template_id", template_id)
      .select(
        "report_template_id, report_template_name, report_template_status, report_template_setup_json, updated_on"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to save setup JSON." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    console.error(`PUT /api/company/templates/[template_id]/setup error:`, err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/company/templates/[template_id]/setup — Update specific fields (e.g. setup_id)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || (session.accountType !== "company_user" && session.accountType !== "platform_admin")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { template_id } = await params;
    const body = await req.json();
    const { setup_id, setup_json } = body;

    const adminClient = createAdminClient();

    let query = adminClient
      .from("report_templates")
      .update({ 
        setup_id, 
        report_template_setup_json: setup_json,
        updated_on: new Date().toISOString() 
      })
      .eq("report_template_id", template_id);

    if (session.accountType !== "platform_admin") {
      query = query.eq("company_id", session.companyId);
    }

    const { data, error } = await query.select("*").single();

    if (error) throw error;

    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    console.error(`PATCH /api/company/templates/[template_id]/setup error:`, err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
